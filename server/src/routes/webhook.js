import crypto from 'node:crypto';
import { Membership, WebhookEvent } from '../models/index.js';
import { config } from '../config.js';
import { verifyWebhookSignature } from '../domain/razorpaySignature.js';
import { applyPaymentSuccess, moveMembership } from '../services/membership.js';
import { audit } from '../services/audit.js';

const sysReq = (req) => ({ user: { role: 'SYSTEM' }, ip: req.ip, get: req.get.bind(req) });

async function findMembership(sub, payment) {
  const subId = sub?.id || payment?.subscription_id;
  let m = subId ? await Membership.findOne({ 'razorpay.subscriptionId': subId }) : null;
  if (!m && sub?.notes?.membershipId) m = await Membership.findById(sub.notes.membershipId);
  return m;
}

async function handle(evt, req) {
  const sub = evt.payload?.subscription?.entity;
  const pay = evt.payload?.payment?.entity;
  const m = await findMembership(sub, pay);
  if (!m) return; // unknown subscription (e.g. created in the dashboard) → ack and ignore
  const sys = sysReq(req);
  const rz = (patch) => Membership.updateOne({ _id: m._id }, { $set: Object.fromEntries(Object.entries(patch).map(([k, v]) => [`razorpay.${k}`, v])) });
  const currentEnd = sub?.current_end ? new Date(sub.current_end * 1000) : undefined;

  switch (evt.event) {
    case 'subscription.authenticated':
      await rz({ status: 'authenticated' });
      break;
    case 'subscription.activated':
    case 'subscription.charged':
      await rz({ status: sub?.status || 'active' });
      await applyPaymentSuccess(m._id, { paymentId: pay?.id, subscriptionId: sub?.id, paidCount: sub?.paid_count, currentEnd }, sys);
      break;
    case 'subscription.pending':
    case 'subscription.halted':
      await rz({ status: sub?.status });
      await Membership.updateOne({ _id: m._id, paymentStatus: 'PAID' }, { $set: { paymentStatus: 'PAST_DUE' } });
      await audit(sys, 'PAYMENT_PAST_DUE', 'Membership', m._id, evt.event);
      break;
    case 'subscription.cancelled': {
      await rz({ status: 'cancelled' });
      const fresh = await Membership.findById(m._id);
      if (!['CANCELLED', 'EXPIRED'].includes(fresh.status)) await moveMembership(fresh, 'CANCELLED', sys, 'Razorpay subscription cancelled');
      break;
    }
    case 'subscription.completed': {
      await rz({ status: 'completed' });
      const fresh = await Membership.findById(m._id);
      if (fresh.status === 'ASSIGNED') await moveMembership(fresh, 'EXPIRED', sys, 'All billing cycles completed');
      break;
    }
    case 'payment.failed':
      await audit(sys, 'PAYMENT_FAILED', 'Membership', m._id, pay?.error_code || '');
      break;
    default:
      break;
  }
}

/** Mounted with express.raw() BEFORE express.json(): the HMAC is over the exact raw bytes. */
export async function razorpayWebhook(req, res, next) {
  try {
    const raw = req.body;
    const sig = req.get('x-razorpay-signature');
    if (!Buffer.isBuffer(raw) || !verifyWebhookSignature(raw, sig, config.razorpay.webhookSecret)) {
      return res.status(400).json({ error: { code: 'BAD_SIGNATURE', message: 'Invalid signature' } });
    }
    const evt = JSON.parse(raw.toString('utf8'));
    const eventId = req.get('x-razorpay-event-id') || crypto.createHash('sha256').update(raw).digest('hex');
    try {
      await WebhookEvent.create({ eventId, type: evt.event });
    } catch (e) {
      if (e.code === 11000) return res.json({ ok: true, duplicate: true });
      throw e;
    }
    try {
      await handle(evt, req);
    } catch (e) {
      await WebhookEvent.deleteOne({ eventId }); // let Razorpay retry
      throw e;
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
