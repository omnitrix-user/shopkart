import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductImage from '../components/ProductImage.jsx';
import StockBadge from '../components/StockBadge.jsx';
import AddToCartButton from '../components/AddToCartButton.jsx';
import Spinner from '../components/Spinner.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews.jsx';
import { fetchWishlist, removeFromWishlist } from '../services/api.js';
import { announceWishlistChange } from '../hooks/useWishlist.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatPrice } from '../utils/format.js';

function WishlistCard({ product, onRemoved }) {
  const { markSignedOut } = useAuth();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  const handleRemove = async () => {
    setRemoving(true);
    setError('');
    try {
      await removeFromWishlist(product._id);
      onRemoved(product._id);
      announceWishlistChange();
    } catch (requestError) {
      if (requestError.status === 404) {
        onRemoved(product._id); // already gone on the server
        announceWishlistChange();
        return;
      }
      if (requestError.isUnauthorized) {
        markSignedOut('session');
        return;
      }
      setError(`Could not remove: ${requestError.message}`);
      setRemoving(false);
    }
  };

  return (
    <article className="product-card card">
      <Link to={`/products/${product._id}`} className="product-card__media" tabIndex={-1} aria-hidden="true">
        <ProductImage src={product.image} alt="" />
      </Link>
      <div className="product-card__body">
        <p className="product-card__category">{product.category}</p>
        <h2 className="product-card__name">
          <Link to={`/products/${product._id}`}>{product.name}</Link>
        </h2>
        <div className="product-card__meta">
          <span className="price">{formatPrice(product.price)}</span>
          <StockBadge stock={product.stock} />
        </div>
        <div className="product-card__actions">
          <AddToCartButton product={product} block />
          <div className="button-row">
            <Link to={`/products/${product._id}`} className="btn btn--outline btn--sm">
              View Details
            </Link>
            <button
              type="button"
              className="btn btn--ghost btn--sm btn--danger"
              onClick={handleRemove}
              disabled={removing}
              aria-busy={removing}
            >
              {removing && <Spinner />}
              {removing ? 'Removing…' : 'Remove'}
            </button>
          </div>
          {error && (
            <p className="action-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Wishlist() {
  const { markSignedOut } = useAuth();
  const [state, setState] = useState({ status: 'loading', wishlist: [], error: null });

  const load = useCallback(
    async (signal) => {
      setState((current) => ({ ...current, status: 'loading', error: null }));
      try {
        const data = await fetchWishlist({ signal });
        setState({ status: 'ready', wishlist: data.wishlist, error: null });
      } catch (error) {
        if (error.canceled) return;
        if (error.isUnauthorized) markSignedOut('session');
        else setState({ status: 'error', wishlist: [], error });
      }
    },
    [markSignedOut],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleRemoved = (productId) =>
    setState((current) => ({ ...current, wishlist: current.wishlist.filter((p) => p._id !== productId) }));

  return (
    <div className="container page">
      <header className="page-header">
        <div>
          <h1 className="page-title">My Wishlist</h1>
          <p className="muted">Products you’ve saved for later.</p>
        </div>
      </header>

      {state.status === 'loading' && <LoadingState label="Loading your wishlist…" />}
      {state.status === 'error' && (
        <ErrorState title="We couldn’t load your wishlist" message={state.error?.message} onRetry={() => load()} />
      )}
      {state.status === 'ready' && state.wishlist.length === 0 && (
        <EmptyState
          icon="♡"
          title="Your wishlist is empty"
          message="Tap “Add to Wishlist” on any product to save it here."
          actionLabel="Browse Products"
          actionTo="/products"
        />
      )}
      {state.status === 'ready' && state.wishlist.length > 0 && (
        <>
          <p className="muted results-count">
            {state.wishlist.length} saved product{state.wishlist.length === 1 ? '' : 's'}
          </p>
          <div className="product-grid">
            {state.wishlist.map((product) => (
              <WishlistCard key={product._id} product={product} onRemoved={handleRemoved} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
