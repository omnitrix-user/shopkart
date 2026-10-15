import Razorpay from 'razorpay';

let client = null;
let clientKeyId = null;

const readKey = (name) => (process.env[name] || '').trim();

export const getRazorpayKeyId = () => readKey('RAZORPAY_KEY_ID');

/** The secret never leaves the backend: it is only used here and for signature verification. */
export const getRazorpayKeySecret = () => readKey('RAZORPAY_KEY_SECRET');

export const isRazorpayConfigured = () => Boolean(getRazorpayKeyId() && getRazorpayKeySecret());

/** Lazily creates the Razorpay SDK client so the API can start without payment keys. */
export function getRazorpayClient() {
  const keyId = getRazorpayKeyId();
  if (!client || clientKeyId !== keyId) {
    client = new Razorpay({ key_id: keyId, key_secret: getRazorpayKeySecret() });
    clientKeyId = keyId;
  }
  return client;
}

/** Startup warnings (never include key values). */
export function getRazorpayWarnings() {
  const keyId = getRazorpayKeyId();
  const secret = getRazorpayKeySecret();
  if (!keyId && !secret) {
    return [
      'Razorpay keys are not set. Browsing, wishlist and cart work, but checkout will return 503 until ' +
        'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (Test Mode) are added to backend/.env.',
    ];
  }
  const warnings = [];
  if (!keyId || !secret) {
    warnings.push('Both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set for checkout to work.');
  }
  if (keyId.startsWith('rzp_live_')) {
    warnings.push('RAZORPAY_KEY_ID is a LIVE key. This project must only use Test Mode keys (rzp_test_...).');
  } else if (keyId && !keyId.startsWith('rzp_test_')) {
    warnings.push('RAZORPAY_KEY_ID does not look like a Razorpay Test Mode key (expected rzp_test_...).');
  }
  return warnings;
}
