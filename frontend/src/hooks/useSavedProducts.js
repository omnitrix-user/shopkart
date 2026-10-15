import { useCallback, useMemo, useState } from 'react';
import { useWishlistSnapshot } from './useWishlist.js';

/** Which products are in the wishlist, with instant local updates after a toggle. */
export function useSavedProducts() {
  const wishlist = useWishlistSnapshot();
  const [overrides, setOverrides] = useState({});

  const savedIds = useMemo(() => new Set((wishlist || []).map((product) => product._id)), [wishlist]);

  const isSaved = useCallback(
    (productId) => (productId in overrides ? overrides[productId] : savedIds.has(productId)),
    [overrides, savedIds],
  );

  const setSaved = useCallback((productId, saved) => {
    setOverrides((current) => ({ ...current, [productId]: saved }));
  }, []);

  return { isSaved, setSaved };
}
