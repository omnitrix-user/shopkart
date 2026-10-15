import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProductImage from '../components/ProductImage.jsx';
import StockBadge from '../components/StockBadge.jsx';
import WishlistButton from '../components/WishlistButton.jsx';
import AddToCartButton from '../components/AddToCartButton.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews.jsx';
import { fetchProduct } from '../services/api.js';
import { formatPrice } from '../utils/format.js';
import { useSessionCheck } from '../hooks/useSessionCheck.js';
import { useSavedProducts } from '../hooks/useSavedProducts.js';

export default function ProductDetails() {
  useSessionCheck();
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading', product: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const { isSaved, setSaved } = useSavedProducts();

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', product: null, error: null });
    fetchProduct(id, { signal: controller.signal })
      .then((data) => setState({ status: 'ready', product: data.product, error: null }))
      .catch((error) => {
        if (!error.canceled) setState({ status: 'error', product: null, error });
      });
    return () => controller.abort();
  }, [id, reloadKey]);

  const { status, product, error } = state;

  return (
    <div className="container page">
      <Link to="/products" className="back-link">
        ← Back to products
      </Link>

      {status === 'loading' && <LoadingState label="Loading product…" />}

      {status === 'error' &&
        (error.status === 404 || error.status === 400 ? (
          <EmptyState
            icon="📦"
            title="Product not found"
            message="This product doesn’t exist or is no longer available."
            actionLabel="Browse Products"
            actionTo="/products"
          />
        ) : (
          <ErrorState
            title="We couldn’t load this product"
            message={error.message}
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        ))}

      {status === 'ready' && (
        <article className="product-detail card">
          <div className="product-detail__media">
            <ProductImage src={product.image} alt={product.name} />
          </div>
          <div className="product-detail__body">
            <p className="product-card__category">{product.category}</p>
            <h1 className="product-detail__name">{product.name}</h1>
            <p className="product-detail__price price">{formatPrice(product.price)}</p>
            <StockBadge stock={product.stock} />
            <p className="product-detail__description">{product.description}</p>
            <div className="product-detail__actions">
              <AddToCartButton product={product} block />
              <WishlistButton
                productId={product._id}
                saved={isSaved(product._id)}
                onChange={(next) => setSaved(product._id, next)}
                block
              />
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
