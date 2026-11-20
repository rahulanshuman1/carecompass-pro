import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

let loading;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => { loading = null; reject(new Error('Could not load the payment window. Check your connection.')); };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Opens Razorpay Checkout for a SUBSCRIPTION.
 * Resolves with { mode: 'checkout', response } on success, { mode: 'external' } when the hosted
 * payment page was opened (native app), rejects with Error('dismissed') if the user closes it.
 */
export async function startSubscriptionCheckout(s) {
  if (Capacitor.isNativePlatform()) {
    // Native WebView: use Razorpay's hosted subscription page; the webhook activates the membership.
    await Browser.open({ url: s.shortUrl });
    return { mode: 'external' };
  }
  await loadCheckout();
  return new Promise((resolve, reject) => {
    const rz = new window.Razorpay({
      key: s.keyId,
      ...(s.mode === 'order'
        ? { order_id: s.subscriptionId, amount: Math.round(s.amountInr * 100), currency: 'INR' }
        : { subscription_id: s.subscriptionId }),
      name: 'CareCompass',
      description: `${s.planName} membership`,
      prefill: s.prefill,
      theme: { color: '#1f7f7a' },
      handler: (response) => resolve({ mode: 'checkout', response }),
      modal: { ondismiss: () => reject(new Error('dismissed')) },
    });
    rz.on('payment.failed', (r) => reject(new Error(r?.error?.description || 'Payment failed. Please try again.')));
    rz.open();
  });
}
