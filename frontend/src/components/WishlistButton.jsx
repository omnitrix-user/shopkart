import { useState } from 'react';
import { toggleWishlist } from '../services/api.js';
import { announceWishlistChange } from '../hooks/useWishlist.js';
import { useRequireLogin } from '../hooks/useRequireLogin.js';
import { useAuth } from '../context/AuthContext.jsx';

/** Adds/removes a product from the logged-in customer's wishlist via the backend. */
export default function WishlistButton({ productId, saved, onChange, block = false }) {
  const { markSignedOut } = useAuth();
  const requireLogin = useRequireLogin();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    if (saving || !requireLogin('Please log in to save products to your wishlist.')) return;
    setSaving(true);
    setError('');
    try {
      const result = await toggleWishlist(productId);
      onChange?.(result.saved);
      announceWishlistChange();
    } catch (requestError) {
      if (requestError.isUnauthorized) {
        markSignedOut('session');
        return;
      }
      setError(`Could not update wishlist: ${requestError.message}`);
    } finally {
      setSaving(false);
    }
  };

  let label = '♡ Add to Wishlist';
  if (saving) label = '⏳ Saving...';
  else if (saved) label = '♥ Added to Wishlist';

  return (
    <div className={`action-stack${block ? ' action-stack--block' : ''}`}>
      <button
        type="button"
        className={`btn btn--sm wishlist-btn${saved ? ' wishlist-btn--saved' : ''}${block ? ' btn--block' : ''}`}
        onClick={handleClick}
        disabled={saving}
        aria-pressed={Boolean(saved)}
        aria-busy={saving}
        title={saved ? 'Click to remove from wishlist' : undefined}
      >
        {label}
      </button>
      {error && (
        <p className="action-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
