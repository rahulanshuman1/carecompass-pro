import Razorpay from 'razorpay';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';

let client;
export function rzp() {
  if (!config.razorpay.enabled) throw new AppError(503, 'Online payments are not configured yet.', 'PAYMENTS_DISABLED');
  client ??= new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
  return client;
}

const wrap = (e) => {
  // Razorpay SDK errors look like { statusCode, error: { description } }
  console.error('[razorpay]', e?.statusCode, JSON.stringify(e?.error || e?.message || e));
  const d = e?.error;
  const msg = d?.description || (typeof d === 'string' ? d : '') || e?.message
    || `HTTP ${e?.statusCode || 'unknown'} ${d?.code || ''} ${d?.reason || ''}`.trim() || 'Payment provider error';
  return new AppError(502, `Razorpay: ${msg}`, 'RAZORPAY_ERROR');
};

/** Razorpay plans are immutable, so we create one per MembershipPlan, once. */
export async function ensureRazorpayPlan(plan) {
  if (plan.razorpayPlanId) return plan.razorpayPlanId;
  try {
    const r = await rzp().plans.create({
      period: 'monthly',
      interval: 1,
      item: { name: plan.name, amount: Math.round(plan.priceInr * 100), currency: 'INR', description: `${plan.name} membership` },
      notes: { membershipPlanId: String(plan._id) }, // ids only: never put PHI in Razorpay
    });
    plan.razorpayPlanId = r.id;
    await plan.save();
    return r.id;
  } catch (e) {
    throw e instanceof AppError ? e : wrap(e);
  }
}

export async function createSubscription({ membership, plan, patient }) {
  const planId = await ensureRazorpayPlan(plan);
  try {
    return await rzp().subscriptions.create({
      plan_id: planId,
      total_count: plan.cycles,
      quantity: 1,
      customer_notify: 1,
      notes: { membershipId: String(membership._id), patientId: String(patient._id) },
    });
  } catch (e) {
    throw wrap(e);
  }
}

export async function cancelSubscription(subscriptionId) {
  try {
    return await rzp().subscriptions.cancel(subscriptionId, false);
  } catch (e) {
    // already cancelled/completed is fine
    if (/cancel|complete/i.test(e?.error?.description || '')) return null;
    throw wrap(e);
  }
}

/** One-time order (works without the Subscriptions product). Used when PAYMENT_MODE=order. */
export async function createOrder({ membership, plan }) {
  try {
    return await rzp().orders.create({
      amount: Math.round(plan.priceInr * 100),
      currency: 'INR',
      receipt: `m_${String(membership._id).slice(-12)}`,
      notes: { membershipId: String(membership._id) },
    });
  } catch (e) {
    throw wrap(e);
  }
}
