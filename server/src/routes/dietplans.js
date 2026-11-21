import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { DietPlan, Membership, Assignment, PatientProfile, AdherenceLog } from '../models/index.js';
import { asyncHandler, need, AppError } from '../utils/errors.js';
import { authenticate, requireRole, validate, validObjectId, requirePatientAccess } from '../middleware/index.js';
import { assertPlanTransition } from '../domain/dietplan.js';
import { canViewPatient } from '../domain/rbac.js';
import { audit } from '../services/audit.js';
import { autoGeneratePlan } from '../services/autoplan.js';
import { todayStr } from '../utils/dates.js';
import { config } from '../config.js';

const r = Router();
r.use(authenticate);

const num = (min, max) => z.coerce.number().min(min).max(max);
const mealZ = z.object({
  time: z.string().regex(/^\d\d:\d\d$/, 'Use HH:MM for meal times.'),
  name: z.string().trim().max(40),
  items: z.array(z.object({ name: z.string().trim().min(1).max(80), qty: z.string().trim().max(40).default(''), kcal: num(0, 5000) })).max(25),
});
const regionZ = z.object({ country: z.string().trim().max(60).default(''), state: z.string().trim().max(60).default(''), cuisine: z.string().trim().max(60).default('') }).default({});
const planBody = z.object({
  region: regionZ,
  title: z.string().trim().max(120),
  startDate: z.string().regex(/^\d{4}-\d\d-\d\d$/, 'Choose a start date.'),
  targets: z.object({ kcal: num(0, 10000), protein: num(0, 1000), carbs: num(0, 2000), fat: num(0, 1000), waterMl: num(0, 20000) }),
  supplements: z.string().trim().max(300).default(''),
  notes: z.string().trim().max(1000).default(''),
  meals: z.array(mealZ).max(12),
});

async function atomically(fn) {
  const s = await mongoose.startSession();
  try {
    let out;
    await s.withTransaction(async () => { out = await fn(s); });
    return out;
  } catch (e) {
    if (/replica set|Transaction numbers/i.test(e.message)) return fn(null); // local standalone Mongo
    throw e;
  } finally {
    s.endSession();
  }
}

/* Create a draft (or a revision cloned from the latest plan) */
r.post('/patients/:patientId/diet-plans', validObjectId, requireRole('DIETITIAN'), requirePatientAccess(), asyncHandler(async (req, res) => {
  const pid = req.params.patientId;
  const m = await Membership.findOne({ patient: pid });
  need(m?.status === 'ASSIGNED', 409, 'Membership must be in Assigned status.', 'INVALID_STATE');
  const all = await DietPlan.find({ patient: pid }).sort({ version: -1 });
  need(!all.some((p) => ['DRAFT', 'IN_REVIEW'].includes(p.status)), 409, 'Finish the current draft or review first.', 'INVALID_STATE');
  const base = all[0];
  const prof = await PatientProfile.findOne({ user: pid }).select('history');
  const hist = prof?.history || {};
  const data = base
    ? { region: base.region?.country ? { country: base.region.country, state: base.region.state, cuisine: base.region.cuisine } : { country: hist.country || '', state: hist.state || '', cuisine: hist.cuisine || '' }, title: base.title, startDate: todayStr(config.tz), targets: base.targets, supplements: base.supplements, notes: base.notes, meals: base.meals.map((x) => ({ time: x.time, name: x.name, items: x.items })) }
    : { region: { country: hist.country || '', state: hist.state || '', cuisine: hist.cuisine || '' }, title: '', startDate: todayStr(config.tz), meals: [{ time: '08:00', name: 'Breakfast', items: [] }] };
  const plan = await DietPlan.create({ ...data, patient: pid, dietitian: req.user.id, version: (base?.version || 0) + 1, status: 'DRAFT' });
  await audit(req, 'PLAN_CREATED', 'DietPlan', plan._id, `v${plan.version}`);
  res.status(201).json({ plan });
}));

/* Fully automated: build the next plan from the Lead's Plan Studio rules. It lands in IN_REVIEW for one-click approval.
   A dietitian's unfinished draft is replaced (the screen asks first). */
r.post('/patients/:patientId/diet-plans/auto', validObjectId, requireRole('DIETITIAN', 'LEAD_DOCTOR'), requirePatientAccess(), asyncHandler(async (req, res) => {
  const out = await autoGeneratePlan(req.params.patientId, { req, replaceDraft: true });
  need(out.plan, 409, out.skipped || 'Could not generate a plan.', 'INVALID_STATE');
  res.status(201).json({ plan: out.plan });
}));

r.get('/diet-plans/review-queue', requireRole('LEAD_DOCTOR'), asyncHandler(async (_req, res) => {
  const items = await DietPlan.find({ status: 'IN_REVIEW' }).sort({ submittedAt: 1 }).populate('patient', 'name').populate('dietitian', 'name');
  res.json({ items });
}));

async function loadPlan(req) {
  const plan = await DietPlan.findById(req.params.id);
  need(plan, 404, 'Plan not found', 'NOT_FOUND');
  const assignment = await Assignment.findOne({ patient: plan.patient, isOpen: true });
  need(canViewPatient(req.user, plan.patient, assignment) && req.user.role !== 'CARE_TEAM', 403, 'You do not have access to this plan.', 'FORBIDDEN');
  return plan;
}

r.get('/diet-plans/:id', validObjectId, asyncHandler(async (req, res) => {
  res.json({ plan: await loadPlan(req) });
}));

r.put('/diet-plans/:id', validObjectId, requireRole('DIETITIAN'), validate(planBody), asyncHandler(async (req, res) => {
  const plan = await loadPlan(req);
  need(String(plan.dietitian) === req.user.id, 403, 'Only the plan author can edit it.', 'FORBIDDEN');
  need(plan.status === 'DRAFT', 409, 'Only drafts can be edited. Create a revision instead.', 'INVALID_STATE');
  const b = req.body;
  plan.set({ region: b.region, title: b.title, startDate: b.startDate, targets: b.targets, supplements: b.supplements, notes: b.notes, meals: b.meals });
  await plan.save();
  await audit(req, 'PLAN_SAVED', 'DietPlan', plan._id);
  res.json({ plan });
}));

r.delete('/diet-plans/:id', validObjectId, requireRole('DIETITIAN'), asyncHandler(async (req, res) => {
  const plan = await loadPlan(req);
  need(String(plan.dietitian) === req.user.id, 403, 'Only the plan author can discard it.', 'FORBIDDEN');
  need(plan.status === 'DRAFT', 409, 'Only drafts can be discarded.', 'INVALID_STATE');
  await plan.deleteOne();
  await audit(req, 'PLAN_DISCARDED', 'DietPlan', plan._id, `v${plan.version}`);
  res.json({ ok: true });
}));

r.post('/diet-plans/:id/submit', validObjectId, requireRole('DIETITIAN'), asyncHandler(async (req, res) => {
  const plan = await loadPlan(req);
  assertPlanTransition(plan, 'IN_REVIEW', { role: req.user.role, userId: req.user.id });
  plan.status = 'IN_REVIEW';
  plan.submittedAt = new Date();
  plan.reviewNote = '';
  await plan.save();
  await audit(req, 'PLAN_SUBMITTED', 'DietPlan', plan._id, `v${plan.version}`);
  res.json({ plan });
}));

r.post(
  '/diet-plans/:id/review',
  validObjectId, requireRole('LEAD_DOCTOR'),
  validate(z.object({ decision: z.enum(['approve', 'changes']), note: z.string().trim().max(500).default('') })),
  asyncHandler(async (req, res) => {
    const plan = await loadPlan(req);
    const { decision, note } = req.body;
    const to = decision === 'approve' ? 'ACTIVE' : 'DRAFT';
    assertPlanTransition(plan, to, { role: req.user.role, userId: req.user.id, note });
    if (to === 'ACTIVE') {
      await atomically(async (session) => {
        // archive the previous live plan first so the one-ACTIVE-per-patient unique index holds
        await DietPlan.updateMany({ patient: plan.patient, status: 'ACTIVE' }, { $set: { status: 'ARCHIVED' } }, { session });
        plan.status = 'ACTIVE';
        plan.approvedBy = req.user.id;
        plan.approvedAt = new Date();
        plan.reviewNote = note;
        await plan.save({ session });
      });
    } else {
      plan.status = 'DRAFT';
      plan.reviewNote = note;
      await plan.save();
    }
    await audit(req, to === 'ACTIVE' ? 'PLAN_APPROVED' : 'PLAN_CHANGES_REQUESTED', 'DietPlan', plan._id, `v${plan.version}`);
    res.json({ plan });
  }),
);

/* Meal diary: photos the patient attached when marking meals done (dietitian and lead doctor only) */
r.get('/patients/:patientId/meal-diary', validObjectId, requireRole('DIETITIAN', 'LEAD_DOCTOR'), requirePatientAccess(), asyncHandler(async (req, res) => {
  const pid = req.params.patientId;
  const since = new Date(Date.now() - 14 * 86400e3).toISOString().slice(0, 10);
  const [plan, logs] = await Promise.all([
    DietPlan.findOne({ patient: pid, status: 'ACTIVE' }).select('meals'),
    AdherenceLog.find({ patient: pid, date: { $gte: since }, 'photos.0': { $exists: true } }).sort({ date: -1 }).limit(14),
  ]);
  const names = new Map((plan?.meals || []).map((m) => [String(m._id), `${m.time} ${m.name}`]));
  await audit(req, 'VIEW_MEAL_DIARY', 'Patient', pid);
  res.json({ days: logs.map((l) => ({ date: l.date, photos: l.photos.map((p) => ({ mealId: p.mealId, meal: names.get(p.mealId) || 'Meal', photo: p.photo, at: p.at })) })) });
}));

export default r;
export { AppError };
