import { Router } from 'express';
import { z } from 'zod';
import { PatientProfile, Membership, Assignment, DietPlan, AdherenceLog, CareNote, MembershipPlan } from '../models/index.js';
import { asyncHandler, AppError, need } from '../utils/errors.js';
import { authenticate, requireRole, validate } from '../middleware/index.js';
import { audit } from '../services/audit.js';
import { adherenceMap } from '../services/adherence.js';
import { todayStr, lastNDates } from '../utils/dates.js';
import { config } from '../config.js';

const r = Router();
r.use(authenticate, requireRole('PATIENT'));

const populateMembership = (q) => q.populate('plan').populate('requestedPlan');

r.get('/', asyncHandler(async (req, res) => {
  const pid = req.user.id;
  const [profile, membership, assignment, active] = await Promise.all([
    PatientProfile.findOne({ user: pid }),
    populateMembership(Membership.findOne({ patient: pid })),
    Assignment.findOne({ patient: pid, isOpen: true }).populate('dietitian', 'name specialty +photo'),
    DietPlan.findOne({ patient: pid, status: 'ACTIVE' }).select('title version startDate dietitian'),
  ]);
  const adh = await adherenceMap([pid]);
  res.json({
    user: { id: pid, name: req.user.name, email: req.user.email },
    profile,
    membership,
    dietitian: assignment?.dietitian || null,
    activePlan: active,
    adherence: adh.get(pid) ?? null,
  });
}));

const arr = (max) => z.array(z.string().trim().min(1).max(80)).max(max).default([]);
const historySchema = z.object({
  dob: z.string().refine((s) => {
    const d = new Date(s);
    if (Number.isNaN(+d) || d > new Date()) return false;
    return (Date.now() - +d) / 31557600000 <= 120;
  }, 'Enter a valid date of birth.'),
  sex: z.enum(['Female', 'Male', 'Other'], { errorMap: () => ({ message: 'Select sex.' }) }),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{6,19}$/, 'Enter a valid phone number.'),
  heightCm: z.coerce.number().min(80, 'Height must be 80–250 cm.').max(250, 'Height must be 80–250 cm.'),
  weightKg: z.coerce.number().min(20, 'Weight must be 20–400 kg.').max(400, 'Weight must be 20–400 kg.'),
  conditions: arr(20),
  allergies: arr(30),
  medications: z.string().max(1000).default(''),
  labNotes: z.string().max(2000).default(''),
  activity: z.enum(['Sedentary', 'Lightly active', 'Moderately active', 'Very active']),
  sleepHrs: z.coerce.number().min(2).max(14).default(7),
  smoking: z.enum(['Never', 'Former', 'Current']),
  alcohol: z.enum(['Never', 'Occasionally', 'Weekly', 'Daily']),
  dietType: z.enum(['Vegetarian', 'Eggetarian', 'Non-vegetarian', 'Vegan']),
  dislikes: z.string().max(300).default(''),
  goals: z.string().trim().min(10, 'Describe your health goals (at least 10 characters).').max(1000),
  consent: z.literal(true, { errorMap: () => ({ message: 'Consent is required to submit.' }) }),
});

r.put('/history', validate(historySchema), asyncHandler(async (req, res) => {
  const { dob, sex, phone, heightCm, weightKg, consent: _c, ...h } = req.body;
  const prof = await PatientProfile.findOne({ user: req.user.id });
  const first = !prof.historySubmittedAt;
  Object.assign(prof, { dob, sex, phone, heightCm, weightKg });
  prof.history = { ...h, consentAt: new Date(), consentVersion: 'v1' };
  if (first) prof.historySubmittedAt = new Date();
  await prof.save();
  await audit(req, first ? 'HISTORY_SUBMITTED' : 'HISTORY_UPDATED', 'Patient', req.user.id);
  res.json({ profile: prof });
}));

r.post(
  '/request',
  validate(z.object({ planId: z.string().regex(/^[a-f\d]{24}$/i).optional(), message: z.string().trim().max(500).optional() }).refine((b) => b.planId || b.message, 'Add a message or choose a plan.')),
  asyncHandler(async (req, res) => {
    const m = await Membership.findOne({ patient: req.user.id });
    need(['PENDING_ASSISTANCE', 'PLAN_SELECTED'].includes(m.status), 409, 'Your membership is already in progress.', 'INVALID_STATE');
    let text = req.body.message || '';
    if (req.body.planId) {
      const plan = await MembershipPlan.findOne({ _id: req.body.planId, isActive: true });
      need(plan, 404, 'Plan not found', 'NOT_FOUND');
      if (m.status === 'PENDING_ASSISTANCE') m.requestedPlan = plan._id;
      text = `Requested plan: ${plan.name}${text ? ` — ${text}` : ''}`;
    }
    await m.save();
    await CareNote.create({ patient: req.user.id, author: req.user.id, kind: 'PATIENT_MESSAGE', text });
    await audit(req, 'PATIENT_REQUEST', 'Membership', m._id);
    res.json({ ok: true });
  }),
);

/* ---------- Diet plan & adherence ---------- */
r.get('/diet-plan', asyncHandler(async (req, res) => {
  const plan = await DietPlan.findOne({ patient: req.user.id, status: 'ACTIVE' }).populate('dietitian', 'name specialty');
  if (!plan) {
    const pending = await DietPlan.exists({ patient: req.user.id, status: { $in: ['DRAFT', 'IN_REVIEW'] } });
    return res.json({ plan: null, inPreparation: !!pending });
  }
  const today = todayStr(config.tz);
  const dates = lastNDates(7, config.tz).reverse();
  const logs = await AdherenceLog.find({ patient: req.user.id, date: { $in: dates } });
  const byDate = Object.fromEntries(logs.map((l) => [l.date, l]));
  await audit(req, 'VIEW_OWN_PLAN', 'DietPlan', plan._id);
  res.json({
    plan,
    today: byDate[today] || { date: today, mealsDone: [], waterMl: 0, weightKg: null },
    week: dates.map((d) => ({ date: d, mealsDone: byDate[d]?.mealsDone || [], waterMl: byDate[d]?.waterMl || 0 })),
    adherence: (await adherenceMap([req.user.id])).get(req.user.id) ?? 0,
  });
}));

r.put(
  '/adherence/today',
  validate(z.object({ toggleMealId: z.string().regex(/^[a-f\d]{24}$/i).optional(), addWaterMl: z.number().int().min(1).max(2000).optional(), weightKg: z.number().min(20).max(400).optional() })),
  asyncHandler(async (req, res) => {
    const plan = await DietPlan.findOne({ patient: req.user.id, status: 'ACTIVE' });
    need(plan, 409, 'You do not have an active diet plan yet.', 'NO_ACTIVE_PLAN');
    const date = todayStr(config.tz);
    const log = await AdherenceLog.findOneAndUpdate({ patient: req.user.id, date }, { $setOnInsert: { patient: req.user.id, date } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    const { toggleMealId, addWaterMl, weightKg } = req.body;
    if (toggleMealId) {
      need(plan.meals.some((m) => String(m._id) === toggleMealId), 400, 'That meal is not in your plan.', 'VALIDATION');
      log.mealsDone = log.mealsDone.includes(toggleMealId) ? log.mealsDone.filter((x) => x !== toggleMealId) : [...log.mealsDone, toggleMealId];
    }
    if (addWaterMl) log.waterMl = Math.min(10000, log.waterMl + addWaterMl);
    if (weightKg) {
      log.weightKg = weightKg;
      await PatientProfile.updateOne({ user: req.user.id }, { $set: { weightKg } });
    }
    await log.save();
    res.json({ today: log });
  }),
);

export default r;
