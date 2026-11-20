import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { User, Membership, DietPlan, Assignment, AuditLog } from '../models/index.js';
import { asyncHandler, need } from '../utils/errors.js';
import { authenticate, requireRole, validate, validObjectId } from '../middleware/index.js';
import { adherenceMap } from '../services/adherence.js';
import { dietitianLoads } from '../services/membership.js';
import { audit } from '../services/audit.js';

const r = Router();
r.use(authenticate, requireRole('LEAD_DOCTOR'));

r.get('/analytics', asyncHandler(async (_req, res) => {
  const [mems, dietitians, loads, inReview, activePlans, patients] = await Promise.all([
    Membership.find().populate('plan', 'priceInr name'),
    User.find({ role: 'DIETITIAN', isActive: true }),
    dietitianLoads(),
    DietPlan.countDocuments({ status: 'IN_REVIEW' }),
    DietPlan.find({ status: 'ACTIVE' }).select('patient'),
    User.countDocuments({ role: 'PATIENT' }),
  ]);
  const byStatus = {};
  let revenue = 0;
  for (const m of mems) {
    byStatus[m.status] = (byStatus[m.status] || 0) + 1;
    if (m.paymentStatus === 'PAID' && m.plan) revenue += m.plan.priceInr * (m.paymentMethod === 'RAZORPAY' ? Math.max(1, m.razorpay?.paidCount || 1) : 1);
  }
  const adh = await adherenceMap(activePlans.map((p) => p.patient));
  const vals = [...adh.values()];
  const perDietitian = await Promise.all(
    dietitians.map(async (d) => {
      const pts = (await Assignment.find({ dietitian: d._id, isOpen: true }).select('patient')).map((a) => a.patient);
      const a = pts.map((p) => adh.get(String(p))).filter((x) => x != null);
      return { id: String(d._id), name: d.name, specialty: d.specialty, maxLoad: d.maxLoad || 8, load: loads.get(String(d._id)) || 0, avgAdherence: a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null };
    }),
  );
  res.json({
    totals: {
      patients,
      activeMemberships: (byStatus.ACTIVE || 0) + (byStatus.PENDING_DIETITIAN_ASSIGNMENT || 0) + (byStatus.ASSIGNED || 0),
      plansInReview: inReview,
      avgAdherence: vals.length ? Math.round(vals.reduce((s, x) => s + x, 0) / vals.length) : null,
      collectedInr: revenue,
    },
    funnel: byStatus,
    dietitians: perDietitian,
  });
}));

r.get('/audit', asyncHandler(async (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 100);
  const filter = req.query.action ? { action: String(req.query.action).toUpperCase().slice(0, 40) } : {};
  const items = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).populate('actor', 'name');
  res.json({ items });
}));

r.get('/staff', asyncHandler(async (_req, res) => {
  res.json({ items: await User.find({ role: { $ne: 'PATIENT' } }).select('+photo').sort({ role: 1, name: 1 }) });
}));

r.post(
  '/staff',
  validate(z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email(),
    role: z.enum(['CARE_TEAM', 'DIETITIAN', 'LEAD_DOCTOR']),
    specialty: z.string().trim().max(100).optional(),
    maxLoad: z.coerce.number().int().min(1).max(100).optional(),
  })),
  asyncHandler(async (req, res) => {
    need(!(await User.exists({ email: req.body.email })), 409, 'An account with this email already exists.', 'EMAIL_TAKEN');
    const temp = `Cc-${crypto.randomBytes(6).toString('base64url')}-9`;
    const u = await User.create({ ...req.body, maxLoad: req.body.role === 'DIETITIAN' ? req.body.maxLoad || 8 : undefined, passwordHash: await bcrypt.hash(temp, 12), mustChangePassword: true });
    await audit(req, 'STAFF_CREATED', 'User', u._id, req.body.role);
    // The temporary password is shown ONCE. In production, deliver it via your email provider instead.
    res.status(201).json({ user: u, temporaryPassword: temp });
  }),
);

r.patch(
  '/staff/:id', validObjectId,
  validate(z.object({ isActive: z.boolean().optional(), maxLoad: z.coerce.number().int().min(1).max(100).optional() })),
  asyncHandler(async (req, res) => {
    need(req.params.id !== req.user.id, 400, 'You cannot change your own account here.', 'VALIDATION');
    const u = await User.findOne({ _id: req.params.id, role: { $ne: 'PATIENT' } });
    need(u, 404, 'Staff member not found', 'NOT_FOUND');
    if (req.body.isActive === false) {
      need(!(await Assignment.exists({ dietitian: u._id, isOpen: true })), 409, 'Reassign this dietitian’s patients first.', 'HAS_PATIENTS');
      u.refreshTokens = [];
    }
    Object.assign(u, req.body);
    await u.save();
    await audit(req, 'STAFF_UPDATED', 'User', u._id, JSON.stringify(req.body));
    res.json({ user: u });
  }),
);

export default r;
