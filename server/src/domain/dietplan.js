import { AppError, label } from '../utils/errors.js';

export const PLAN_TRANSITIONS = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['ACTIVE', 'DRAFT'],
  ACTIVE: ['ARCHIVED'],
  ARCHIVED: [],
};

/** Returns a list of human-readable problems (empty = valid for submission). */
export function validatePlanContent(p) {
  const e = [];
  const t = p.targets || {};
  if (!p.title || p.title.trim().length < 3) e.push('Add a plan title.');
  if (!p.startDate) e.push('Choose a start date.');
  if (!(t.kcal >= 800 && t.kcal <= 5000)) e.push('Calories must be between 800 and 5000.');
  if (!(t.protein > 0 && t.carbs > 0 && t.fat > 0)) e.push('Protein, carbs and fat targets must be above 0.');
  if (!(t.waterMl >= 500 && t.waterMl <= 6000)) e.push('Water target must be between 500 and 6000 ml.');
  if (!p.meals || !p.meals.length) e.push('Add at least one meal.');
  (p.meals || []).forEach((m, i) => {
    const n = m.name?.trim() || `Meal ${i + 1}`;
    if (!m.name?.trim()) e.push(`Meal ${i + 1}: add a name.`);
    if (!/^\d\d:\d\d$/.test(m.time || '')) e.push(`${n}: set a time.`);
    if (!m.items?.length) e.push(`${n}: add at least one food item.`);
    (m.items || []).forEach((it) => {
      if (!it.name?.trim() || !(it.kcal >= 0)) e.push(`${n}: every food needs a name and calories.`);
    });
  });
  return [...new Set(e)];
}

export const planKcal = (p) => (p.meals || []).reduce((s, m) => s + (m.items || []).reduce((a, i) => a + (i.kcal || 0), 0), 0);

/**
 * ctx: { role, userId, note, authorId }
 * DRAFT→IN_REVIEW: author (dietitian) only, content must validate
 * IN_REVIEW→ACTIVE|DRAFT: lead doctor only; DRAFT needs a note
 */
export function assertPlanTransition(plan, to, ctx) {
  if (!(PLAN_TRANSITIONS[plan.status] || []).includes(to)) {
    throw new AppError(409, `Invalid plan transition: ${label(plan.status)} → ${label(to)}.`, 'INVALID_TRANSITION');
  }
  if (plan.status === 'DRAFT' && to === 'IN_REVIEW') {
    if (ctx.role !== 'DIETITIAN' || String(ctx.userId) !== String(plan.dietitian))
      throw new AppError(403, 'Only the plan author can submit it for review.', 'FORBIDDEN');
    const errs = validatePlanContent(plan);
    if (errs.length) throw new AppError(422, errs.join(' '), 'PLAN_INVALID', errs);
  }
  if (plan.status === 'IN_REVIEW') {
    if (ctx.role !== 'LEAD_DOCTOR') throw new AppError(403, 'Only the lead doctor can review plans.', 'FORBIDDEN');
    if (to === 'DRAFT' && (ctx.note || '').trim().length < 5)
      throw new AppError(422, 'Add a note explaining the requested changes.', 'NOTE_REQUIRED');
  }
}
