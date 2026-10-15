import { Link } from 'react-router-dom';
import ProductImage from './ProductImage.jsx';
import StockBadge from './StockBadge.jsx';
import WishlistButton from './WishlistButton.jsx';
import AddToCartButton from './AddToCartButton.jsx';
import { formatPrice } from '../utils/format.js';

export default function ProductCard({ product, saved, onWishlistChange }) {
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
          <WishlistButton
            productId={product._id}
            saved={saved}
            onChange={(next) => onWishlistChange?.(product._id, next)}
            block
          />
        </div>
      </div>
    </article>
  );
}
