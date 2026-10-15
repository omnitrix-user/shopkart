import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductImage from '../components/ProductImage.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews.jsx';
import { fetchOrders } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { STATUS_LABELS, formatDate, formatPrice, orderReference } from '../utils/format.js';

export default function Orders() {
  const { markSignedOut } = useAuth();
  const [state, setState] = useState({ status: 'loading', orders: [], error: null });

  const load = useCallback(
    async (signal) => {
      setState((current) => ({ ...current, status: 'loading', error: null }));
      try {
        const { orders } = await fetchOrders({ signal });
        setState({ status: 'ready', orders, error: null });
      } catch (error) {
        if (error.canceled) return;
        if (error.isUnauthorized) markSignedOut('session');
        else setState({ status: 'error', orders: [], error });
      }
    },
    [markSignedOut],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="container page">
      <header className="page-header">
        <div>
          <h1 className="page-title">My Orders</h1>
          <p className="muted">Your paid orders, newest first.</p>
        </div>
      </header>

      {state.status === 'loading' && <LoadingState label="Loading your orders…" />}
      {state.status === 'error' && (
        <ErrorState title="We couldn’t load your orders" message={state.error?.message} onRetry={() => load()} />
      )}
      {state.status === 'ready' && state.orders.length === 0 && (
        <EmptyState
          icon="📦"
          title="No orders yet"
          message="When you place an order, it will appear here."
          actionLabel="Start Shopping"
          actionTo="/products"
        />
      )}
      {state.status === 'ready' && state.orders.length > 0 && (
        <ul className="order-list">
          {state.orders.map((order) => {
            const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            return (
              <li key={order._id} className="card order-card">
                <div className="order-card__thumbs" aria-hidden="true">
                  {order.items.slice(0, 3).map((item) => (
                    <ProductImage key={String(item.product)} src={item.image} alt="" className="order-card__thumb" />
                  ))}
                </div>
                <div className="order-card__info">
                  <p className="order-card__ref">
                    Order {orderReference(order._id)}{' '}
                    <span className={`status-pill status-pill--${order.status.toLowerCase()}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </p>
                  <p className="muted">
                    {formatDate(order.createdAt)} · {itemCount} item{itemCount === 1 ? '' : 's'}
                  </p>
                </div>
                <p className="order-card__total price">{formatPrice(order.totalAmount)}</p>
                <Link to={`/orders/${order._id}`} className="btn btn--outline btn--sm">
                  View details
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
