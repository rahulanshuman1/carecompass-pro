import { Router } from 'express';
import { z } from 'zod';
import { Assignment, DietPlan, Membership, PatientProfile, PlanStudio, User } from '../models/index.js';
import { asyncHandler, need } from '../utils/errors.js';
import { authenticate, requireRole, validate } from '../middleware/index.js';
import { ACTIONS, FIELDS, OPS, defaultStudio } from '../domain/studioDefaults.js';
import { buildContext, generatePlan, validateStudio } from '../domain/planEngine.js';
import { autoGeneratePlan, loadStudio, previewForPatient } from '../services/autoplan.js';
import { audit } from '../services/audit.js';

const r = Router();
r.use(authenticate, requireRole('LEAD_DOCTOR'));

const num = (a, b) => z.coerce.number().min(a).max(b);
const text = (n) => z.string().trim().max(n);
const allOps = [...new Set(Object.values(OPS).flat().map(([o]) => o))];
const macros = z.object({ protein: num(0, 100), carbs: num(0, 100), fat: num(0, 100) });

const studioZ = z.object({
  calories: z.object({
    method: z.enum(['mifflin', 'harris', 'fixed']),
    fixedKcal: num(800, 5000), fallbackKcal: num(800, 5000),
    activity: z.record(text(40), num(1, 2.5)).refine((o) => Object.keys(o).length <= 10),
    defaultActivity: num(1, 2.5), minKcal: num(800, 5000), maxKcal: num(800, 6000), roundTo: num(1, 500),
  }),
  macros,
  water: z.object({ perKg: num(10, 80), min: num(500, 6000), max: num(500, 8000), roundTo: num(1, 1000) }),
  titleTemplate: text(80),
  slots: z.array(z.object({
    id: text(30), name: text(40).min(1), time: z.string().regex(/^\d\d:\d\d$/, 'Use HH:MM for meal times.'),
    meal: z.enum(['B', 'S', 'L', 'D']), share: num(1, 100), maxItems: num(1, 8),
  })).max(10),
  allergens: z.array(z.object({ id: text(30), name: text(40).min(1), aliases: z.array(text(40)).max(20), foodWords: z.array(text(40)).max(40) })).max(30),
  rules: z.array(z.object({
    id: text(30), name: text(80).min(1), enabled: z.boolean().default(true), match: z.enum(['all', 'any']), stop: z.boolean().default(false),
    conditions: z.array(z.object({ field: z.enum(Object.keys(FIELDS)), op: z.enum(allOps), value: z.union([text(100), z.number()]).default('') })).max(10),
    actions: z.array(z.object({ type: z.enum(Object.keys(ACTIONS)), value: z.union([text(300), z.number(), macros]).default('') })).min(1).max(10),
  })).max(60),
});

const meta = () => ({ fields: FIELDS, ops: OPS, actions: ACTIONS });

r.get('/', asyncHandler(async (_req, res) => {
  const { studio, version } = await loadStudio();
  res.json({ studio, version, meta: meta() });
}));

r.put('/', validate(studioZ), asyncHandler(async (req, res) => {
  const problems = validateStudio(req.body);
  need(!problems.length, 422, problems.join(' '), 'STUDIO_INVALID');
  await loadStudio();
  const doc = await PlanStudio.findOneAndUpdate({ key: 'default' }, { $set: { config: req.body, updatedBy: req.user.id }, $inc: { version: 1 } }, { new: true });
  await audit(req, 'STUDIO_SAVED', 'PlanStudio', doc._id, `v${doc.version}, ${req.body.rules.length} rules`);
  res.json({ studio: doc.config, version: doc.version });
}));

r.post('/reset', asyncHandler(async (req, res) => {
  await loadStudio();
  const doc = await PlanStudio.findOneAndUpdate({ key: 'default' }, { $set: { config: defaultStudio(), updatedBy: req.user.id }, $inc: { version: 1 } }, { new: true });
  await audit(req, 'STUDIO_RESET', 'PlanStudio', doc._id, `v${doc.version}`);
  res.json({ studio: doc.config, version: doc.version });
}));

/* Patients the Lead can use to test the rules */
r.get('/patients', asyncHandler(async (_req, res) => {
  const profs = await PatientProfile.find({ historySubmittedAt: { $exists: true } }).select('user').limit(60);
  const users = await User.find({ _id: { $in: profs.map((p) => p.user) } }).select('name').sort({ name: 1 });
  res.json({ items: users.map((u) => ({ id: String(u._id), name: u.name })) });
}));

/** Dry run with the working (even unsaved) rules. Nothing is stored. */
r.post('/preview', validate(z.object({ patientId: z.string().regex(/^[a-f\d]{24}$/i).optional(), sample: z.record(z.any()).optional(), studio: studioZ.optional() })), asyncHandler(async (req, res) => {
  const { patientId, sample, studio } = req.body;
  if (studio) { const p = validateStudio(studio); need(!p.length, 422, p.join(' '), 'STUDIO_INVALID'); }
  if (patientId) {
    await audit(req, 'STUDIO_PREVIEW', 'Patient', patientId);
    return res.json(await previewForPatient(patientId, studio));
  }
  need(sample, 422, 'Choose a patient or fill in a sample.', 'VALIDATION');
  const base = buildContext({ name: 'Sample' }, { dob: sample.age ? new Date(Date.now() - Number(sample.age) * 365.25 * 864e5) : null, sex: sample.sex, weightKg: Number(sample.weightKg) || null, heightCm: Number(sample.heightCm) || null, history: {
    activity: sample.activity, dietType: sample.dietType || 'Vegetarian', conditions: sample.conditions || [], allergies: sample.allergies || [], goals: sample.goals || '', dislikes: sample.dislikes || '',
    sleepHrs: sample.sleepHrs ?? 7, country: sample.country || 'India', state: sample.state || '', cuisine: sample.cuisine || '' } });
  const loaded = studio ? { studio, version: 0 } : await loadStudio();
  res.json({ ...generatePlan(base, loaded.studio, { seed: 7 }), studioVersion: loaded.version, context: base });
}));

/** Backfill: generate plans for every assigned patient who has none yet. */
r.post('/generate-missing', asyncHandler(async (req, res) => {
  const assigned = await Membership.find({ status: 'ASSIGNED' }).select('patient');
  const withPlan = new Set((await DietPlan.distinct('patient', { patient: { $in: assigned.map((m) => m.patient) } })).map(String));
  const open = new Set((await Assignment.distinct('patient', { isOpen: true })).map(String));
  let created = 0; const skipped = [];
  for (const m of assigned) {
    const pid = String(m.patient);
    if (withPlan.has(pid) || !open.has(pid)) continue;
    const out = await autoGeneratePlan(pid, { req });
    if (out.plan) created += 1; else skipped.push(out.skipped);
  }
  res.json({ created, skipped: skipped.length });
}));

export default r;
