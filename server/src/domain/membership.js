import { AppError, label } from '../utils/errors.js';

/** Allowed membership status moves. Anything not listed is rejected. */
export const MEMBERSHIP_TRANSITIONS = {
  PENDING_ASSISTANCE: ['PLAN_SELECTED', 'CANCELLED'],
  PLAN_SELECTED: ['ACTIVE', 'PENDING_ASSISTANCE', 'CANCELLED'],
  ACTIVE: ['PENDING_DIETITIAN_ASSIGNMENT', 'CANCELLED'],
  PENDING_DIETITIAN_ASSIGNMENT: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['EXPIRED', 'CANCELLED'],
  EXPIRED: [],
  CANCELLED: [],
};
export const MEMBERSHIP_STATUSES = Object.keys(MEMBERSHIP_TRANSITIONS);
export const PAYMENT_STATUSES = ['UNPAID', 'PAID', 'PAST_DUE', 'REFUNDED'];

const ACTORS = ['CARE_TEAM', 'LEAD_DOCTOR', 'SYSTEM'];

/**
 * ctx: { actorRole, hasPlan, paymentStatus, hasAssignment }
 * Throws AppError if the transition is not permitted.
 */
export function assertMembershipTransition(from, to, ctx) {
  if (!ACTORS.includes(ctx.actorRole)) {
    throw new AppError(403, 'You do not have permission to change membership status.', 'FORBIDDEN');
  }
  const allowed = MEMBERSHIP_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new AppError(
      409,
      `Invalid transition: ${label(from)} → ${label(to)}. Allowed from here: ${
        allowed.map(label).join(', ') || 'none (final state)'
      }.`,
      'INVALID_TRANSITION',
    );
  }
  if (to === 'PLAN_SELECTED' && !ctx.hasPlan) throw new AppError(422, 'Choose a membership plan first.', 'PLAN_REQUIRED');
  if (to === 'ACTIVE' && ctx.paymentStatus !== 'PAID')
    throw new AppError(422, 'Payment must be confirmed before activating.', 'PAYMENT_REQUIRED');
  if (to === 'ASSIGNED' && !ctx.hasAssignment)
    throw new AppError(422, 'A dietitian must be assigned first.', 'ASSIGNMENT_REQUIRED');
}
