import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductImage from '../components/ProductImage.jsx';
import OrderSummary from '../components/OrderSummary.jsx';
import Spinner from '../components/Spinner.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews.jsx';
import { useCart } from '../context/CartContext.jsx';
import { formatPrice } from '../utils/format.js';

function CartRow({ item }) {
  const { updateQuantity, removeFromCart, pending } = useCart();
  const [error, setError] = useState('');
  const { product, quantity } = item;
  const busy = pending[product._id];

  const run = async (action) => {
    setError('');
    try {
      await action();
    } catch (requestError) {
      if (!requestError.isUnauthorized) setError(requestError.message);
    }
  };

  return (
    <li className="cart-row">
      <Link to={`/products/${product._id}`} className="cart-row__media" tabIndex={-1} aria-hidden="true">
        <ProductImage src={product.image} alt="" />
      </Link>
      <div className="cart-row__info">
        <Link to={`/products/${product._id}`} className="cart-row__name">
          {product.name}
        </Link>
        <p className="muted cart-row__unit">{formatPrice(product.price)} each</p>
        {quantity >= product.stock && (
          <p className="cart-row__note">Maximum available ({product.stock}) in your cart</p>
        )}
        {error && (
          <p className="action-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="cart-row__controls">
        <div className="qty" role="group" aria-label={`Quantity for ${product.name}`}>
          <button
            type="button"
            className="qty__btn"
            onClick={() => run(() => updateQuantity(product._id, quantity - 1))}
            disabled={Boolean(busy) || quantity <= 1}
            aria-label="Decrease quantity"
            title={quantity <= 1 ? 'Use Remove to delete this item' : undefined}
          >
            −
          </button>
          <span className="qty__value" aria-live="polite">
            {busy === 'update' ? <Spinner /> : quantity}
          </span>
          <button
            type="button"
            className="qty__btn"
            onClick={() => run(() => updateQuantity(product._id, quantity + 1))}
            disabled={Boolean(busy) || quantity >= product.stock}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <p className="cart-row__total">{formatPrice(product.price * quantity)}</p>
        <button
          type="button"
          className="link-button btn--danger"
          onClick={() => run(() => removeFromCart(product._id))}
          disabled={Boolean(busy)}
        >
          {busy === 'remove' ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </li>
  );
}

export default function Cart() {
  const { cartItems, loading, loaded, error, cartCount, subtotal, refreshCart } = useCart();
  // On the cart page itself, re-read the latest prices and stock from the server.
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);
  const navigate = useNavigate();

  const outOfStockItem = cartItems.find((item) => item.quantity > item.product.stock);

  return (
    <div className="container page">
      <header className="page-header">
        <div>
          <h1 className="page-title">My Cart</h1>
          <p className="muted">Review your items before checkout.</p>
        </div>
      </header>

      {!loaded && (loading || !error) && <LoadingState label="Loading your cart…" />}
      {!loaded && !loading && error && (
        <ErrorState title="We couldn’t load your cart" message={error.message} onRetry={refreshCart} />
      )}
      {loaded && cartItems.length === 0 && (
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          message="Add products to your cart and they’ll show up here."
          actionLabel="Browse Products"
          actionTo="/products"
        />
      )}
      {loaded && cartItems.length > 0 && (
        <div className="cart-layout">
          <section className="card cart-list-card" aria-label="Cart items">
            <ul className="cart-list">
              {cartItems.map((item) => (
                <CartRow key={item.product._id} item={item} />
              ))}
            </ul>
          </section>
          <OrderSummary itemCount={cartCount} subtotal={subtotal}>
            {outOfStockItem && (
              <p className="action-error" role="alert">
                Only {outOfStockItem.product.stock} of {outOfStockItem.product.name} available. Please reduce the
                quantity.
              </p>
            )}
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => navigate('/checkout')}
              disabled={Boolean(outOfStockItem)}
            >
              Proceed to Checkout
            </button>
            <Link to="/products" className="btn btn--ghost btn--block">
              Continue shopping
            </Link>
          </OrderSummary>
        </div>
      )}
    </div>
  );
}
