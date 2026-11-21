import crypto from 'node:crypto';
import { Assignment, DietPlan, Membership, PatientProfile, PlanStudio, User } from '../models/index.js';
import { AppError, need } from '../utils/errors.js';
import { defaultStudio } from '../domain/studioDefaults.js';
import { buildContext, generatePlan } from '../domain/planEngine.js';
import { todayStr } from '../utils/dates.js';
import { config } from '../config.js';
import { audit } from './audit.js';
import { notify } from './notifications.js';

/** The saved studio, or the defaults (saved on first use so the Lead can edit them). */
export async function loadStudio() {
  let doc = await PlanStudio.findOne({ key: 'default' });
  if (!doc) {
    try { doc = await PlanStudio.create({ key: 'default', config: defaultStudio() }); } catch { doc = await PlanStudio.findOne({ key: 'default' }); }
  }
  return { studio: doc.config, version: doc.version };
}

const seedFor = (patientId, version) => parseInt(crypto.createHash('sha1').update(`${patientId}:${version}`).digest('hex').slice(0, 7), 16);

/** Runs the engine for one patient without saving anything. */
export async function previewForPatient(patientId, studioOverride) {
  const [user, profile] = await Promise.all([User.findById(patientId).select('name'), PatientProfile.findOne({ user: patientId })]);
  need(user, 404, 'Patient not found', 'NOT_FOUND');
  need(profile?.historySubmittedAt, 422, 'This patient has not submitted their history yet.', 'HISTORY_REQUIRED');
  const loaded = studioOverride ? { studio: studioOverride, version: 0 } : await loadStudio();
  const ctx = buildContext(user, profile);
  return { ...generatePlan(ctx, loaded.studio, { seed: seedFor(patientId, 'preview') }), studioVersion: loaded.version, context: ctx };
}

/**
 * Creates the next plan version for an ASSIGNED patient from the Lead's rules and puts it straight into
 * IN_REVIEW, so the Lead only has to approve it. Returns { plan } or { skipped: reason }.
 */
export async function autoGeneratePlan(patientId, { req, replaceDraft = false } = {}) {
  const m = await Membership.findOne({ patient: patientId });
  if (m?.status !== 'ASSIGNED') return { skipped: 'Membership is not in Assigned status.' };
  const assignment = await Assignment.findOne({ patient: patientId, isOpen: true });
  if (!assignment) return { skipped: 'No dietitian is assigned.' };
  const [user, profile] = await Promise.all([User.findById(patientId).select('name'), PatientProfile.findOne({ user: patientId })]);
  if (!profile?.historySubmittedAt) return { skipped: 'Patient history has not been submitted.' };

  const all = await DietPlan.find({ patient: patientId }).sort({ version: -1 });
  const pending = all.find((p) => ['DRAFT', 'IN_REVIEW'].includes(p.status));
  if (pending) {
    if (!(replaceDraft && pending.status === 'DRAFT')) return { skipped: 'A draft or review is already in progress.' };
    await pending.deleteOne();
  }
  const latest = await DietPlan.findOne({ patient: patientId }).sort({ version: -1 }).select('version');
  const version = (latest?.version || 0) + 1;
  const { studio, version: studioVersion } = await loadStudio();
  const out = generatePlan(buildContext(user, profile), studio, { seed: seedFor(patientId, version) });
  if (out.error) return { skipped: out.error };

  const plan = await DietPlan.create({
    patient: patientId, dietitian: assignment.dietitian, version,
    status: 'IN_REVIEW', submittedAt: new Date(),
    title: out.title, startDate: todayStr(config.tz), region: out.region, targets: out.targets,
    supplements: out.supplements, notes: out.notes, meals: out.meals,
    auto: { generated: true, studioVersion, generatedAt: new Date(), flags: out.flags, applied: out.applied, warnings: out.warnings },
  });
  await audit(req, 'PLAN_AUTO_GENERATED', 'DietPlan', plan._id, `v${plan.version}, ${out.applied.length} rules, ${out.flags.length} flags`);
  const leads = await User.find({ role: 'LEAD_DOCTOR', isActive: true }).select('_id');
  await Promise.all(leads.map((l) => notify(l._id, {
    kind: 'PLAN_REVIEW', title: `Plan ready to review: ${user.name}`,
    body: out.flags.length ? `Flagged: ${out.flags.map((f) => f.rule).join(', ')}` : 'Generated from your Plan Studio rules.',
    link: `/patient/${patientId}`, dedupeKey: `plan-review:${plan._id}`,
  })));
  return { plan };
}

export { AppError };
