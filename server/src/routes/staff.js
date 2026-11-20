import { Router } from 'express';
import { z } from 'zod';
import { User, PatientProfile, Membership, MembershipPlan, Assignment, DietPlan, CareNote } from '../models/index.js';
import { asyncHandler, need } from '../utils/errors.js';
import { authenticate, requireRole, validate, validObjectId, requirePatientAccess } from '../middleware/index.js';
import { audit } from '../services/audit.js';
import { moveMembership, applyPaymentSuccess, assignDietitian, dietitianLoads } from '../services/membership.js';
import { adherenceMap } from '../services/adherence.js';
import { ensureSubscription } from './billing.js';
import { cancelSubscription } from '../services/razorpay.js';
import { redactProfileFor } from '../domain/rbac.js';
import { escapeRegex, lastNDates } from '../utils/dates.js';
import { AdherenceLog } from '../models/index.js';
import { config } from '../config.js';

const r = Router();
r.use(authenticate);
const admin = requireRole('CARE_TEAM', 'LEAD_DOCTOR');

/* ---------- Queue ---------- */
r.get('/memberships', admin, asyncHandler(async (req, res) => {
  const { status, q } = req.query;
  const filter = {};
  if (status && status !== 'ALL') filter.status = String(status);
  if (q) {
    const users = await User.find({ role: 'PATIENT', name: new RegExp(escapeRegex(String(q).slice(0, 60)), 'i') }).select('_id');
    filter.patient = { $in: users.map((u) => u._id) };
  }
  const rows = await Membership.find(filter).sort({ updatedAt: -1 }).limit(200)
    .populate('patient', 'name email').populate('plan', 'name priceInr').populate('requestedPlan', 'name');
  const profiles = await PatientProfile.find({ user: { $in: rows.map((m) => m.patient?._id) } }).select('user historySubmittedAt');
  const hist = new Set(profiles.filter((p) => p.historySubmittedAt).map((p) => String(p.user)));
  const counts = await Membership.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  res.json({
    items: rows.map((m) => ({ ...m.toJSON(), historySubmitted: hist.has(String(m.patient?._id)) })),
    counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
  });
}));

r.get('/dietitians', requireRole('CARE_TEAM', 'LEAD_DOCTOR'), asyncHandler(async (_req, res) => {
  const [list, loads] = await Promise.all([User.find({ role: 'DIETITIAN', isActive: true }).sort({ name: 1 }), dietitianLoads()]);
  res.json({ items: list.map((d) => ({ id: String(d._id), name: d.name, specialty: d.specialty, maxLoad: d.maxLoad || 8, load: loads.get(String(d._id)) || 0 })) });
}));

r.get('/my/patients', requireRole('DIETITIAN'), asyncHandler(async (req, res) => {
  const as = await Assignment.find({ dietitian: req.user.id, isOpen: true }).populate('patient', 'name email');
  const ids = as.map((a) => a.patient._id);
  const [profiles, plans, adh] = await Promise.all([
    PatientProfile.find({ user: { $in: ids } }),
    DietPlan.find({ patient: { $in: ids } }).sort({ version: -1 }).select('patient status version'),
    adherenceMap(ids),
  ]);
  res.json({
    items: as.map((a) => {
      const pid = String(a.patient._id);
      const latest = plans.find((p) => String(p.patient) === pid);
      const prof = profiles.find((p) => String(p.user) === pid);
      return { id: pid, name: a.patient.name, goals: prof?.history?.goals || '', planStatus: latest?.status || null, adherence: adh.get(pid) ?? null, assignedAt: a.assignedAt };
    }),
  });
}));

/* ---------- Patient detail (role-filtered) ---------- */
r.get('/patients/:patientId', validObjectId, requireRole('CARE_TEAM', 'LEAD_DOCTOR', 'DIETITIAN'), requirePatientAccess(), asyncHandler(async (req, res) => {
  const pid = req.params.patientId;
  const user = await User.findOne({ _id: pid, role: 'PATIENT' });
  need(user, 404, 'Patient not found', 'NOT_FOUND');
  const role = req.user.role;
  const [profile, membership, assignment, notes] = await Promise.all([
    PatientProfile.findOne({ user: pid }),
    Membership.findOne({ patient: pid }).populate('plan').populate('requestedPlan').populate('events.by', 'name'),
    Assignment.findOne({ patient: pid, isOpen: true }).populate('dietitian', 'name specialty'),
    CareNote.find({ patient: pid }).sort({ createdAt: -1 }).limit(50).populate('author', 'name'),
  ]);
  const out = {
    patient: { id: pid, name: user.name, email: user.email },
    profile: redactProfileFor(role, profile?.toJSON()),
    membership,
    assignment,
    notes,
  };
  if (role !== 'CARE_TEAM') {
    out.dietPlans = await DietPlan.find({ patient: pid }).sort({ version: -1 });
    const dates = lastNDates(7, config.tz).reverse();
    out.adherence = {
      pct: (await adherenceMap([pid])).get(pid) ?? null,
      days: (await AdherenceLog.find({ patient: pid, date: { $in: dates } })).map((l) => ({ date: l.date, meals: l.mealsDone.length, waterMl: l.waterMl, weightKg: l.weightKg })),
    };
  }
  await audit(req, 'VIEW_PHI', 'Patient', pid);
  res.json(out);
}));

r.post(
  '/patients/:patientId/notes',
  validObjectId, requireRole('CARE_TEAM', 'LEAD_DOCTOR', 'DIETITIAN'), requirePatientAccess(),
  validate(z.object({ text: z.string().trim().min(3, 'Write a note first.').max(1000) })),
  asyncHandler(async (req, res) => {
    const kind = req.user.role === 'CARE_TEAM' ? 'CARE' : 'CLINICAL';
    const n = await CareNote.create({ patient: req.params.patientId, author: req.user.id, kind, text: req.body.text });
    await audit(req, 'NOTE_ADDED', 'Patient', req.params.patientId, kind);
    res.status(201).json({ note: n });
  }),
);

/* ---------- Membership workflow (care team / lead doctor) ---------- */
r.post(
  '/memberships/:patientId/select-plan',
  validObjectId, admin, validate(z.object({ planId: z.string().regex(/^[a-f\d]{24}$/i) })),
  asyncHandler(async (req, res) => {
    const m = await Membership.findOne({ patient: req.params.patientId });
    need(m, 404, 'Membership not found', 'NOT_FOUND');
    need(['PENDING_ASSISTANCE', 'PLAN_SELECTED'].includes(m.status), 409, 'The plan can only be changed before activation.', 'INVALID_STATE');
    const plan = await MembershipPlan.findOne({ _id: req.body.planId, isActive: true });
    need(plan, 404, 'Plan not found or inactive', 'NOT_FOUND');
    if (m.razorpay?.subscriptionId && String(m.plan) !== String(plan._id)) {
      cancelSubscription(m.razorpay.subscriptionId).catch(() => {});
      m.set('razorpay', {});
    }
    m.plan = plan._id;
    if (m.status === 'PENDING_ASSISTANCE') await moveMembership(m, 'PLAN_SELECTED', req, `Plan: ${plan.name}`);
    else await m.save();
    await audit(req, 'PLAN_SELECTED', 'Membership', m._id, plan.name);
    res.json({ membership: await Membership.findById(m._id).populate('plan') });
  }),
);

r.post(
  '/memberships/:patientId/transition',
  validObjectId, admin,
  validate(z.object({ to: z.enum(['PENDING_ASSISTANCE', 'CANCELLED', 'EXPIRED']), reason: z.string().trim().max(200).optional() })),
  asyncHandler(async (req, res) => {
    const m = await Membership.findOne({ patient: req.params.patientId });
    need(m, 404, 'Membership not found', 'NOT_FOUND');
    await moveMembership(m, req.body.to, req, req.body.reason || '');
    res.json({ membership: m });
  }),
);

r.post('/memberships/:patientId/payment-link', validObjectId, admin, asyncHandler(async (req, res) => {
  const mem = await Membership.findOne({ patient: req.params.patientId });
  need(mem, 404, 'Membership not found', 'NOT_FOUND');
  const m = await ensureSubscription(mem, req);
  res.json({ shortUrl: m.razorpay.shortUrl, subscriptionId: m.razorpay.subscriptionId });
}));

r.post(
  '/memberships/:patientId/offline-payment',
  validObjectId, admin, validate(z.object({ reference: z.string().trim().min(3, 'Enter a receipt or UPI reference.').max(80) })),
  asyncHandler(async (req, res) => {
    const m = await Membership.findOne({ patient: req.params.patientId });
    need(m, 404, 'Membership not found', 'NOT_FOUND');
    need(m.status === 'PLAN_SELECTED', 409, 'Confirm a plan before recording payment.', 'INVALID_STATE');
    need(!m.razorpay?.subscriptionId || ['created', 'cancelled'].includes(m.razorpay.status), 409, 'An online subscription is already in progress for this patient.', 'INVALID_STATE');
    const { m: updated, activated } = await applyPaymentSuccess(m._id, { method: 'OFFLINE', reference: req.body.reference }, req);
    res.json({ membership: updated, activated });
  }),
);

r.post(
  '/memberships/:patientId/assign',
  validObjectId, admin, validate(z.object({ dietitianId: z.string().regex(/^[a-f\d]{24}$/i).optional(), auto: z.boolean().optional() }).refine((b) => b.dietitianId || b.auto, 'Choose a dietitian.')),
  asyncHandler(async (req, res) => {
    let id = req.body.dietitianId;
    if (!id) {
      const [list, loads] = await Promise.all([User.find({ role: 'DIETITIAN', isActive: true }), dietitianLoads()]);
      const pick = list
        .map((d) => ({ d, load: loads.get(String(d._id)) || 0, max: d.maxLoad || 8 }))
        .filter((x) => x.load < x.max)
        .sort((a, b) => a.load / a.max - b.load / b.max)[0];
      need(pick, 409, 'All dietitians are at capacity.', 'CAPACITY');
      id = String(pick.d._id);
    }
    const dt = await assignDietitian(req.params.patientId, id, req);
    res.json({ dietitian: { id: String(dt._id), name: dt.name } });
  }),
);

export default r;
