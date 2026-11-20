import crypto from 'node:crypto';

const safeEqual = (a, b) => {
  const A = Buffer.from(String(a || ''), 'utf8');
  const B = Buffer.from(String(b || ''), 'utf8');
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};

/** Checkout success callback for SUBSCRIPTIONS: HMAC_SHA256(payment_id + "|" + subscription_id, key_secret) */
export function verifyCheckoutSignature({ paymentId, subscriptionId, signature }, keySecret) {
  if (!paymentId || !subscriptionId || !signature || !keySecret) return false;
  const expected = crypto.createHmac('sha256', keySecret).update(`${paymentId}|${subscriptionId}`).digest('hex');
  return safeEqual(expected, signature);
}

/** Webhook: HMAC_SHA256(raw request body, webhook_secret) compared with X-Razorpay-Signature */
export function verifyWebhookSignature(rawBody, signature, webhookSecret) {
  if (!rawBody || !signature || !webhookSecret) return false;
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

/** Checkout success callback for ORDERS: HMAC_SHA256(order_id + "|" + payment_id, key_secret) */
export function verifyOrderSignature({ orderId, paymentId, signature }, keySecret) {
  if (!orderId || !paymentId || !signature || !keySecret) return false;
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}
