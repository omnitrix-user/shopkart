import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import OrderItems from '../components/OrderItems.jsx';
import StatusTimeline from '../components/StatusTimeline.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews.jsx';
import { useOrder } from '../hooks/useOrder.js';
import { useAuth } from '../context/AuthContext.jsx';
import { advanceOrderStatus } from '../services/api.js';
import {
  ORDER_STEPS,
  PAYMENT_LABELS,
  STATUS_LABELS,
  formatDateTime,
  formatPrice,
  orderReference,
} from '../utils/format.js';

/** Demo control for the order-status bonus; the backend disables it in production. */
function StatusDemo({ order, onUpdated }) {
  const { markSignedOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const next = ORDER_STEPS[ORDER_STEPS.indexOf(order.status) + 1];

  if (order.paymentStatus !== 'PAID' || !next) return null;

  const advance = async () => {
    setSaving(true);
    setError('');
    try {
      const { order: updated } = await advanceOrderStatus(order._id, next);
      onUpdated(updated);
    } catch (requestError) {
      if (requestError.isUnauthorized) markSignedOut('session');
      else setError(requestError.status === 404 ? 'Status updates are disabled on this server.' : requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="demo-box">
      <p className="muted">
        <strong>Demo:</strong> simulate the store processing this order.
      </p>
      <button type="button" className="btn btn--outline btn--sm" onClick={advance} disabled={saving}>
        {saving && <Spinner />}
        Mark as {STATUS_LABELS[next]}
      </button>
      {error && (
        <p className="action-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function OrderDetails() {
  const { id } = useParams();
  const { status, order, error, reload, setOrder } = useOrder(id);

  return (
    <div className="container page">
      <Link to="/orders" className="back-link">
        ← Back to my orders
      </Link>

      {status === 'loading' && <LoadingState label="Loading order…" />}
      {status === 'error' &&
        (error.status === 404 || error.status === 400 ? (
          <EmptyState
            icon="📦"
            title="Order not found"
            message="This order doesn’t exist or doesn’t belong to your account."
            actionLabel="View My Orders"
            actionTo="/orders"
          />
        ) : (
          <ErrorState title="We couldn’t load this order" message={error.message} onRetry={reload} />
        ))}

      {status === 'ready' && (
        <>
          <header className="page-header">
            <div>
              <h1 className="page-title">Order {orderReference(order._id)}</h1>
              <p className="muted">Placed {formatDateTime(order.paidAt || order.createdAt)}</p>
            </div>
            <span className={`status-pill status-pill--${order.status.toLowerCase()}`}>
              {STATUS_LABELS[order.status]}
            </span>
          </header>

          {order.paymentStatus !== 'PAID' && (
            <Alert tone="info">{PAYMENT_LABELS[order.paymentStatus]} — this order has not been placed.</Alert>
          )}

          <div className="cart-layout">
            <div className="stack">
              {order.paymentStatus === 'PAID' && (
                <section className="card section-card" aria-labelledby="progress-title">
                  <h2 id="progress-title" className="card__title">
                    Order progress
                  </h2>
                  <StatusTimeline order={order} />
                  <StatusDemo order={order} onUpdated={setOrder} />
                </section>
              )}
              <section className="card section-card" aria-labelledby="items-title">
                <h2 id="items-title" className="card__title">
                  Items
                </h2>
                <OrderItems items={order.items} />
              </section>
            </div>

            <div className="stack">
              <section className="card section-card" aria-labelledby="payment-title">
                <h2 id="payment-title" className="card__title">
                  Payment
                </h2>
                <dl className="summary-lines">
                  <div>
                    <dt>Status</dt>
                    <dd>{PAYMENT_LABELS[order.paymentStatus]}</dd>
                  </div>
                  <div>
                    <dt>Method</dt>
                    <dd>Razorpay (Test Mode)</dd>
                  </div>
                  {order.razorpayPaymentId && (
                    <div>
                      <dt>Payment ID</dt>
                      <dd className="mono">{order.razorpayPaymentId}</dd>
                    </div>
                  )}
                  <div className="summary-lines__total">
                    <dt>Total</dt>
                    <dd>{formatPrice(order.totalAmount)}</dd>
                  </div>
                </dl>
              </section>
              <section className="card section-card" aria-labelledby="ship-title">
                <h2 id="ship-title" className="card__title">
                  Shipping to
                </h2>
                <address className="address">
                  <strong>{order.shippingAddress.fullName}</strong>
                  <br />
                  {order.shippingAddress.addressLine1}
                  <br />
                  {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
                  <br />
                  {order.shippingAddress.phone}
                </address>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
