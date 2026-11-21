import { Membership, Assignment, DietPlan, PatientProfile, User } from '../models/index.js';
import { autoGeneratePlan } from './autoplan.js';
import { assertMembershipTransition } from '../domain/membership.js';
import { AppError, need } from '../utils/errors.js';
import { audit } from './audit.js';
import { cancelSubscription } from './razorpay.js';
import { config } from '../config.js';

const actorOf = (req) => ({ id: req?.user?.id, role: req?.user?.role || 'SYSTEM' });

/** Applies a validated membership transition and records the event + audit entry. */
export async function moveMembership(m, to, req, reason = '') {
  const actor = actorOf(req);
  const hasAssignment = !!(await Assignment.exists({ patient: m.patient, isOpen: true }));
  assertMembershipTransition(m.status, to, {
    actorRole: actor.role,
    hasPlan: !!m.plan,
    paymentStatus: m.paymentStatus,
    hasAssignment,
  });
  const from = m.status;
  m.events.push({ from, to, by: actor.id, actor: actor.role, reason, at: new Date() });
  m.status = to;
  if (to === 'ACTIVE') m.activatedAt = new Date();
  await m.save();
  await audit(req, 'MEMBERSHIP_TRANSITION', 'Membership', m._id, `${from} → ${to}${reason ? ` (${reason})` : ''}`);
  if (to === 'CANCELLED' && m.razorpay?.subscriptionId && config.razorpay.enabled) {
    try {
      await cancelSubscription(m.razorpay.subscriptionId);
    } catch (e) {
      await audit(req, 'RAZORPAY_CANCEL_FAILED', 'Membership', m._id, e.message);
    }
  }
  return m;
}

/**
 * Idempotent: called by BOTH the checkout-verify endpoint and the webhook.
 * The atomic findOneAndUpdate guarantees only one caller performs the activation.
 */
export async function applyPaymentSuccess(membershipId, { paymentId, subscriptionId, method = 'RAZORPAY', paidCount, currentEnd, reference }, req) {
  const set = { paymentStatus: 'PAID', paymentMethod: method };
  if (paymentId) set['razorpay.paymentId'] = paymentId;
  if (subscriptionId) set['razorpay.subscriptionId'] = subscriptionId;
  if (paidCount != null) set['razorpay.paidCount'] = paidCount;
  if (currentEnd) set['razorpay.currentEnd'] = currentEnd;
  if (reference) set.offlineReference = reference;

  const first = await Membership.findOneAndUpdate({ _id: membershipId, paymentStatus: { $ne: 'PAID' } }, { $set: set });
  const m = await Membership.findById(membershipId);
  if (!m) throw new AppError(404, 'Membership not found', 'NOT_FOUND');
  if (!first) {
    // Already paid: only refresh counters (recurring charges), never re-activate.
    if (paidCount != null || currentEnd) {
      if (paidCount != null) m.razorpay.paidCount = Math.max(m.razorpay.paidCount || 0, paidCount);
      if (currentEnd) m.razorpay.currentEnd = currentEnd;
      await m.save();
    }
    return { m, activated: false };
  }
  await audit(req, 'PAYMENT_CONFIRMED', 'Membership', m._id, `${method} ${paymentId || reference || ''}`);
  if (m.status === 'PLAN_SELECTED') {
    const sys = { user: { role: 'SYSTEM' }, ip: req?.ip, get: req?.get?.bind(req) };
    await moveMembership(m, 'ACTIVE', sys, `Payment via ${method}`);
    await moveMembership(m, 'PENDING_DIETITIAN_ASSIGNMENT', sys, 'Awaiting dietitian');
    return { m, activated: true };
  }
  return { m, activated: false };
}

/** Assign or reassign a dietitian with capacity and history guards. */
export async function assignDietitian(patientId, dietitianId, req) {
  const m = await Membership.findOne({ patient: patientId });
  need(m, 404, 'Membership not found', 'NOT_FOUND');
  need(['PENDING_DIETITIAN_ASSIGNMENT', 'ASSIGNED'].includes(m.status), 409, 'Membership must be active and awaiting assignment.', 'INVALID_STATE');
  const dt = await User.findOne({ _id: dietitianId, role: 'DIETITIAN', isActive: true });
  need(dt, 404, 'Dietitian not found', 'NOT_FOUND');
  const prof = await PatientProfile.findOne({ user: patientId });
  need(prof?.historySubmittedAt, 422, 'Patient history must be submitted before assignment.', 'HISTORY_REQUIRED');
  const cur = await Assignment.findOne({ patient: patientId, isOpen: true });
  need(!cur || String(cur.dietitian) !== String(dietitianId), 409, 'That dietitian is already assigned.', 'ALREADY_ASSIGNED');
  const load = await Assignment.countDocuments({ dietitian: dietitianId, isOpen: true });
  need(load < (dt.maxLoad || 8), 409, `${dt.name} is at capacity (${dt.maxLoad || 8} patients).`, 'CAPACITY');

  if (cur) {
    cur.isOpen = false;
    cur.endedAt = new Date();
    await cur.save();
  }
  try {
    await Assignment.create({ patient: patientId, dietitian: dietitianId, assignedBy: req.user.id });
  } catch (e) {
    if (e.code === 11000) throw new AppError(409, 'Another assignment was just made for this patient. Refresh and try again.', 'CONFLICT');
    throw e;
  }
  await audit(req, cur ? 'REASSIGN' : 'ASSIGN', 'Patient', patientId, `to ${dt.name}`);
  if (m.status === 'PENDING_DIETITIAN_ASSIGNMENT') await moveMembership(m, 'ASSIGNED', req, `Assigned to ${dt.name}`);
  // Fully automated plan: build the first plan from the Lead's Plan Studio rules (goes to the Lead for approval).
  // Only for patients who have no plan yet, and never blocks the assignment if generation fails.
  try {
    if (!(await DietPlan.exists({ patient: patientId }))) await autoGeneratePlan(patientId, { req });
  } catch (e) { console.error('auto plan failed', e.message); }
  return dt;
}

export async function dietitianLoads() {
  const rows = await Assignment.aggregate([{ $match: { isOpen: true } }, { $group: { _id: '$dietitian', n: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}
