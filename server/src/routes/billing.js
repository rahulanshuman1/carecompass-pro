import { Router } from 'express';
import { z } from 'zod';
import { Membership, User } from '../models/index.js';
import { PatientProfile } from '../models/index.js';
import { asyncHandler, need } from '../utils/errors.js';
import { authenticate, requireRole, validate, validObjectId } from '../middleware/index.js';
import { createSubscription, rzp } from '../services/razorpay.js';
import { applyPaymentSuccess } from '../services/membership.js';
import { verifyCheckoutSignature } from '../domain/razorpaySignature.js';
import { audit } from '../services/audit.js';
import { config } from '../config.js';

/** Creates (or reuses) the Razorpay subscription for a membership in PLAN_SELECTED. */
export async function ensureSubscription(membershipDoc, req) {
  const m = await Membership.findById(membershipDoc._id).populate('plan');
  need(m.status === 'PLAN_SELECTED', 409, 'A plan must be confirmed by the care team before payment.', 'INVALID_STATE');
  need(m.paymentStatus !== 'PAID', 409, 'This membership is already paid.', 'ALREADY_PAID');
  need(m.plan?.isActive, 409, 'The selected plan is no longer available.', 'PLAN_UNAVAILABLE');
  rzp(); // throws 503 if not configured
  const patient = await User.findById(m.patient);
  if (m.razorpay?.subscriptionId && ['created', 'authenticated'].includes(m.razorpay.status)) return m;
  const sub = await createSubscription({ membership: m, plan: m.plan, patient });
  m.set('razorpay.subscriptionId', sub.id);
  m.set('razorpay.status', sub.status);
  m.set('razorpay.shortUrl', sub.short_url);
  m.set('razorpay.paidCount', 0);
  await m.save();
  await audit(req, 'SUBSCRIPTION_CREATED', 'Membership', m._id, sub.id);
  return m;
}

const r = Router();
r.use(authenticate, requireRole('PATIENT'));

// Patient starts checkout
r.post('/subscription', asyncHandler(async (req, res) => {
  const mem = await Membership.findOne({ patient: req.user.id });
  const m = await ensureSubscription(mem, req);
  const prof = await PatientProfile.findOne({ user: req.user.id });
  res.json({
    keyId: config.razorpay.keyId,
    subscriptionId: m.razorpay.subscriptionId,
    shortUrl: m.razorpay.shortUrl,
    planName: m.plan.name,
    amountInr: m.plan.priceInr,
    cycles: m.plan.cycles,
    prefill: { name: req.user.name, email: req.user.email, contact: prof?.phone || '' },
  });
}));

// Checkout success callback → verify signature, then activate (idempotent with the webhook)
r.post(
  '/subscription/verify',
  validate(z.object({ razorpay_payment_id: z.string().min(5), razorpay_subscription_id: z.string().min(5), razorpay_signature: z.string().min(10) })),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const m = await Membership.findOne({ patient: req.user.id });
    need(m.razorpay?.subscriptionId === b.razorpay_subscription_id, 400, 'Subscription does not match your membership.', 'VALIDATION');
    const ok = verifyCheckoutSignature({ paymentId: b.razorpay_payment_id, subscriptionId: b.razorpay_subscription_id, signature: b.razorpay_signature }, config.razorpay.keySecret);
    if (!ok) {
      await audit(req, 'PAYMENT_SIGNATURE_INVALID', 'Membership', m._id);
      need(false, 400, 'Payment verification failed. If money was deducted it will be reconciled automatically.', 'BAD_SIGNATURE');
    }
    const { m: updated, activated } = await applyPaymentSuccess(m._id, { paymentId: b.razorpay_payment_id, subscriptionId: b.razorpay_subscription_id }, req);
    res.json({ status: updated.status, paymentStatus: updated.paymentStatus, activated });
  }),
);

export default r;
export { validObjectId };
