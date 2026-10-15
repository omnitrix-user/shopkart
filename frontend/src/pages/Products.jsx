import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews.jsx';
import { fetchProducts } from '../services/api.js';
import { useSessionCheck } from '../hooks/useSessionCheck.js';
import { useSavedProducts } from '../hooks/useSavedProducts.js';

export default function Products() {
  useSessionCheck();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';

  const [searchInput, setSearchInput] = useState(search);
  const [state, setState] = useState({ status: 'loading', products: [], categories: [], error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const { isSaved, setSaved } = useSavedProducts();

  const updateParam = useCallback(
    (key, value) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Keep the box in sync when the URL changes elsewhere (navbar link, back button).
  const [syncedSearch, setSyncedSearch] = useState(search);
  if (search !== syncedSearch) {
    setSyncedSearch(search);
    if (searchInput.trim() !== search) setSearchInput(search);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim() !== search) updateParam('search', searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search, updateParam]);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading', error: null }));
    fetchProducts({ search, category }, { signal: controller.signal })
      .then((data) =>
        setState({ status: 'ready', products: data.products, categories: data.categories, error: null }),
      )
      .catch((error) => {
        if (!error.canceled) setState((current) => ({ ...current, status: 'error', error }));
      });
    return () => controller.abort();
  }, [search, category, reloadKey]);

  const filtered = Boolean(search || category);

  return (
    <div className="container page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="muted">Browse the ShopKart catalogue and save favourites for later.</p>
        </div>
      </header>

      <form className="filters card" role="search" onSubmit={(event) => event.preventDefault()}>
        <label className="filters__search">
          <span className="sr-only">Search products</span>
          <input
            type="search"
            className="field__input"
            placeholder="Search products…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            maxLength={100}
          />
        </label>
        <label className="filters__category">
          <span className="sr-only">Category</span>
          <select
            className="field__input"
            value={category}
            onChange={(event) => updateParam('category', event.target.value)}
          >
            <option value="">All categories</option>
            {state.categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {filtered && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setSearchInput('');
              setSearchParams({}, { replace: true });
            }}
          >
            Clear
          </button>
        )}
      </form>

      {state.status === 'loading' && <LoadingState label="Loading products…" />}

      {state.status === 'error' && (
        <ErrorState
          title="We couldn’t load products"
          message={state.error?.message}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      )}

      {state.status === 'ready' && state.products.length === 0 && (
        <EmptyState
          icon="🔍"
          title={filtered ? 'No products match your search' : 'No products yet'}
          message={filtered ? 'Try a different search term or category.' : 'Run “npm run seed” to add sample products.'}
        />
      )}

      {state.status === 'ready' && state.products.length > 0 && (
        <>
          <p className="muted results-count" aria-live="polite">
            {state.products.length} product{state.products.length === 1 ? '' : 's'}
          </p>
          <div className="product-grid">
            {state.products.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                saved={isSaved(product._id)}
                onWishlistChange={setSaved}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
