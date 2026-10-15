const CHECKOUT_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const LOAD_TIMEOUT_MS = 15000;

let loadingPromise = null;

/**
 * Loads Razorpay Checkout once. Resolves to true when window.Razorpay is available,
 * false if the script could not be loaded (offline, blocked by an ad blocker, timeout).
 */
export function loadRazorpayCheckout() {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve(true);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT_URL;
    script.async = true;

    const finish = (loaded) => {
      clearTimeout(timer);
      const available = loaded && Boolean(window.Razorpay);
      if (!available) {
        script.remove();
        loadingPromise = null; // allow a retry
      }
      resolve(available);
    };
    const timer = setTimeout(() => finish(false), LOAD_TIMEOUT_MS);

    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.body.appendChild(script);
  });

  return loadingPromise;
}
