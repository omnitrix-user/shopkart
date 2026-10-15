import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchWishlist } from '../services/api.js';

const WISHLIST_CHANGED = 'shopkart:wishlist-changed';

/** Tell other parts of the page (e.g. the navbar count) to re-read the wishlist from the API. */
export const announceWishlistChange = () => window.dispatchEvent(new Event(WISHLIST_CHANGED));

/**
 * Reads the logged-in customer's wishlist from the backend and re-reads it whenever
 * announceWishlistChange() is called. Not global state: each user of the hook fetches.
 */
export function useWishlistSnapshot() {
  const { status } = useAuth();
  const [wishlist, setWishlist] = useState(null);

  const load = useCallback(async (signal) => {
    try {
      const data = await fetchWishlist({ signal });
      setWishlist(data.wishlist);
    } catch (error) {
      if (!error.canceled) setWishlist((current) => current); // keep the last known value
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') {
      setWishlist(null);
      return undefined;
    }
    const controller = new AbortController();
    load(controller.signal);
    const onChange = () => load();
    window.addEventListener(WISHLIST_CHANGED, onChange);
    return () => {
      controller.abort();
      window.removeEventListener(WISHLIST_CHANGED, onChange);
    };
  }, [status, load]);

  return wishlist;
}
