import { Link, useParams } from 'react-router-dom';
import OrderItems from '../components/OrderItems.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews.jsx';
import { useOrder } from '../hooks/useOrder.js';
import { formatPrice, orderReference } from '../utils/format.js';

export default function OrderSuccess() {
  const { id } = useParams();
  const { status, order, error, reload } = useOrder(id);

  if (status === 'loading') {
    return (
      <div className="container page">
        <LoadingState label="Loading your order…" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container page">
        {error.status === 404 || error.status === 400 ? (
          <EmptyState icon="📦" title="Order not found" actionLabel="View My Orders" actionTo="/orders" />
        ) : (
          <ErrorState title="We couldn’t load your order" message={error.message} onRetry={reload} />
        )}
      </div>
    );
  }

  const paid = order.paymentStatus === 'PAID';

  return (
    <div className="container page">
      <section className="card success-card" aria-labelledby="success-title">
        <span className={`success-card__icon${paid ? '' : ' success-card__icon--warn'}`} aria-hidden="true">
          {paid ? '✓' : '!'}
        </span>
        <h1 id="success-title" className="page-title">
          {paid ? 'Order placed successfully!' : 'Payment not completed'}
        </h1>
        <p className="muted">
          {paid
            ? `Thank you, ${order.shippingAddress.fullName.split(' ')[0]}. Your payment was verified and your order ${orderReference(order._id)} is confirmed.`
            : 'This order has not been paid. Your cart has not been cleared.'}
        </p>

        <dl className="summary-lines success-card__facts">
          <div>
            <dt>Order</dt>
            <dd>{orderReference(order._id)}</dd>
          </div>
          <div>
            <dt>Amount paid</dt>
            <dd>{paid ? formatPrice(order.totalAmount) : '—'}</dd>
          </div>
          {order.razorpayPaymentId && (
            <div>
              <dt>Payment ID</dt>
              <dd className="mono">{order.razorpayPaymentId}</dd>
            </div>
          )}
          <div>
            <dt>Deliver to</dt>
            <dd>
              {order.shippingAddress.city}, {order.shippingAddress.pincode}
            </dd>
          </div>
        </dl>

        <OrderItems items={order.items} />

        <div className="button-row button-row--center">
          <Link to={`/orders/${order._id}`} className="btn btn--primary">
            View order details
          </Link>
          <Link to="/products" className="btn btn--outline">
            Continue shopping
          </Link>
        </div>
      </section>
    </div>
  );
}
