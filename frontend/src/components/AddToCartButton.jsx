import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useRequireLogin } from '../hooks/useRequireLogin.js';
import Spinner from './Spinner.jsx';

export default function AddToCartButton({ product, block = false }) {
  const { addToCart, pending, cartItems } = useCart();
  const requireLogin = useRequireLogin();
  const [error, setError] = useState('');
  const [justAdded, setJustAdded] = useState(false);
  const adding = pending[product._id] === 'add';
  const inCart = cartItems.find((item) => item.product._id === product._id);
  const outOfStock = product.stock <= 0;

  useEffect(() => {
    if (!justAdded) return undefined;
    const timer = setTimeout(() => setJustAdded(false), 2500);
    return () => clearTimeout(timer);
  }, [justAdded]);

  const handleClick = async () => {
    if (adding || !requireLogin('Please log in to add products to your cart.')) return;
    setError('');
    setJustAdded(false);
    try {
      await addToCart(product._id);
      setJustAdded(true);
    } catch (requestError) {
      if (!requestError.isUnauthorized) setError(requestError.message);
    }
  };

  return (
    <div className={`action-stack${block ? ' action-stack--block' : ''}`}>
      <button
        type="button"
        className={`btn btn--primary btn--sm${block ? ' btn--block' : ''}`}
        onClick={handleClick}
        disabled={adding || outOfStock}
        aria-busy={adding}
      >
        {adding && <Spinner />}
        {outOfStock ? 'Out of stock' : adding ? 'Adding...' : 'Add to Cart'}
      </button>
      {justAdded && inCart && (
        <p className="action-success" role="status">
          Added ✓ ({inCart.quantity} in <Link to="/cart">cart</Link>)
        </p>
      )}
      {error && (
        <p className="action-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
