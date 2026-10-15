import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';
import ProductImage from '../components/ProductImage.jsx';
import OrderSummary from '../components/OrderSummary.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { createPaymentOrder, reportPaymentFailed, verifyPayment } from '../services/api.js';
import { loadRazorpayCheckout } from '../utils/loadRazorpay.js';
import { validateShippingAddress } from '../utils/validation.js';
import { formatPrice } from '../utils/format.js';

const CART_KEPT = 'Your cart has not been cleared.';

const STAGE_LABELS = {
  starting: 'Preparing secure payment…',
  paying: 'Complete the payment in the Razorpay window…',
  verifying: 'Verifying your payment…',
};

export default function Checkout() {
  const { customer, markSignedOut } = useAuth();
  const { cartItems, loaded, loading, error: cartError, cartCount, subtotal, refreshCart, clearAfterOrder } = useCart();
  const navigate = useNavigate();

  const [address, setAddress] = useState({
    fullName: customer?.fullName || '',
    phone: customer?.phone || '',
    addressLine1: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [errors, setErrors] = useState({});
  const [stage, setStage] = useState('idle');
  const [message, setMessage] = useState(null); // { tone, text }
  const paymentFailed = useRef(false);

  const busy = stage !== 'idle';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setAddress((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  };

  const fail = (text, tone = 'error') => {
    setMessage({ tone, text });
    setStage('idle');
  };

  const handleApiError = (error) => {
    if (error.isUnauthorized) {
      markSignedOut('session');
      return;
    }
    setErrors(error.fieldErrors || {});
    fail(error.message);
  };

  const verify = async (shopKartOrderId, response) => {
    setStage('verifying');
    setMessage(null);
    try {
      const { order } = await verifyPayment({
        shopKartOrderId,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      });
      setStage('done');
      clearAfterOrder();
      navigate(`/order-success/${order._id}`, { replace: true });
    } catch (error) {
      if (error.isUnauthorized) {
        markSignedOut('session');
        return;
      }
      fail(
        `Payment verification failed: ${error.message}. ${CART_KEPT} If money was deducted, contact support ` +
          `with payment ID ${response.razorpay_payment_id}.`,
      );
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;

    setMessage(null);
    const validationErrors = validateShippingAddress(address);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setMessage({ tone: 'error', text: 'Please fix the highlighted fields.' });
      return;
    }

    setStage('starting');
    // Load Checkout before creating the order, so a blocked script doesn't leave orphan orders.
    if (!(await loadRazorpayCheckout())) {
      fail(
        'Could not load Razorpay Checkout. Check your internet connection, disable ad blockers for this site and try again.',
      );
      return;
    }

    let payment;
    try {
      payment = await createPaymentOrder({
        fullName: address.fullName.trim(),
        phone: address.phone.trim(),
        addressLine1: address.addressLine1.trim(),
        city: address.city.trim(),
        state: address.state.trim(),
        pincode: address.pincode.trim(),
      });
    } catch (error) {
      handleApiError(error);
      if (error.status === 400 && !Object.keys(error.fieldErrors || {}).length) refreshCart();
      return;
    }

    paymentFailed.current = false;
    const razorpay = new window.Razorpay({
      key: payment.key,
      amount: payment.amount,
      currency: payment.currency,
      order_id: payment.razorpayOrderId,
      name: 'ShopKart',
      description: `Order of ${cartCount} item${cartCount === 1 ? '' : 's'}`,
      prefill: { name: address.fullName.trim(), email: customer?.email, contact: address.phone.trim() },
      notes: { shopKartOrderId: payment.shopKartOrderId },
      theme: { color: '#4338CA' },
      handler: (response) => verify(payment.shopKartOrderId, response),
      modal: {
        ondismiss: () => {
          setStage((current) => (current === 'paying' ? 'idle' : current));
          if (!paymentFailed.current) {
            setMessage({ tone: 'info', text: `Payment was cancelled. ${CART_KEPT}` });
          }
        },
      },
    });

    razorpay.on('payment.failed', (response) => {
      paymentFailed.current = true;
      const reason = response?.error?.description;
      setMessage({ tone: 'error', text: `Payment failed. ${CART_KEPT}${reason ? ` (${reason})` : ''}` });
      reportPaymentFailed(payment.shopKartOrderId).catch(() => {});
    });

    setStage('paying');
    razorpay.open();
  };

  if (stage === 'done' || stage === 'verifying') {
    return (
      <div className="container page">
        <LoadingState label={STAGE_LABELS.verifying} />
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="container page">
        {cartError && !loading ? (
          <ErrorState title="We couldn’t load your cart" message={cartError.message} onRetry={refreshCart} />
        ) : (
          <LoadingState label="Loading checkout…" />
        )}
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="container page">
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          message="Add something to your cart before checking out."
          actionLabel="Browse Products"
          actionTo="/products"
        />
      </div>
    );
  }

  return (
    <div className="container page">
      <Link to="/cart" className="back-link">
        ← Back to cart
      </Link>
      <header className="page-header">
        <div>
          <h1 className="page-title">Checkout</h1>
          <p className="muted">Enter your delivery address, then pay securely with Razorpay.</p>
        </div>
        <span className="badge badge--test" title="Razorpay Test Mode — no real money is charged">
          Test Mode
        </span>
      </header>

      <div className="cart-layout">
        <form className="card form checkout-form" onSubmit={handleSubmit} noValidate aria-labelledby="shipping-title">
          <h2 id="shipping-title" className="card__title">
            Shipping address
          </h2>
          <Alert tone={message?.tone}>{message?.text}</Alert>
          <FormField
            label="Full name"
            name="fullName"
            value={address.fullName}
            onChange={handleChange}
            error={errors.fullName}
            autoComplete="name"
            disabled={busy}
          />
          <FormField
            label="Phone number"
            name="phone"
            type="tel"
            value={address.phone}
            onChange={handleChange}
            error={errors.phone}
            hint="10-digit Indian mobile number"
            autoComplete="tel"
            inputMode="tel"
            disabled={busy}
          />
          <FormField
            label="Address"
            name="addressLine1"
            value={address.addressLine1}
            onChange={handleChange}
            error={errors.addressLine1}
            placeholder="House no., street, area"
            autoComplete="address-line1"
            disabled={busy}
          />
          <div className="form-row">
            <FormField
              label="City"
              name="city"
              value={address.city}
              onChange={handleChange}
              error={errors.city}
              autoComplete="address-level2"
              disabled={busy}
            />
            <FormField
              label="State"
              name="state"
              value={address.state}
              onChange={handleChange}
              error={errors.state}
              autoComplete="address-level1"
              disabled={busy}
            />
          </div>
          <FormField
            label="Pincode"
            name="pincode"
            value={address.pincode}
            onChange={handleChange}
            error={errors.pincode}
            inputMode="numeric"
            maxLength={6}
            autoComplete="postal-code"
            disabled={busy}
          />
          <button type="submit" className="btn btn--primary btn--block" disabled={busy} aria-busy={busy}>
            {busy && <Spinner />}
            {busy ? STAGE_LABELS[stage] : `Pay ${formatPrice(subtotal)} with Razorpay`}
          </button>
          <p className="muted checkout-note">
            Payments are handled by Razorpay Checkout — ShopKart never sees or stores your card details. The final
            amount is calculated by our server from current prices.
          </p>
        </form>

        <OrderSummary itemCount={cartCount} subtotal={subtotal}>
          <ul className="mini-items">
            {cartItems.map(({ product, quantity }) => (
              <li key={product._id}>
                <ProductImage src={product.image} alt="" className="mini-items__img" />
                <span className="mini-items__name">
                  {product.name} <span className="muted">× {quantity}</span>
                </span>
                <span>{formatPrice(product.price * quantity)}</span>
              </li>
            ))}
          </ul>
        </OrderSummary>
      </div>
    </div>
  );
}
