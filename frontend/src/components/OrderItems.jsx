import { Link } from 'react-router-dom';
import ProductImage from './ProductImage.jsx';
import { formatPrice } from '../utils/format.js';

/** Line items from the order snapshot (name/price/image at the time of purchase). */
export default function OrderItems({ items }) {
  return (
    <ul className="order-items">
      {items.map((item) => (
        <li key={String(item.product)} className="order-items__row">
          <ProductImage src={item.image} alt="" className="order-items__img" />
          <div className="order-items__info">
            <Link to={`/products/${item.product}`} className="order-items__name">
              {item.name}
            </Link>
            <span className="muted">
              {formatPrice(item.price)} × {item.quantity}
            </span>
          </div>
          <span className="order-items__total">{formatPrice(item.price * item.quantity)}</span>
        </li>
      ))}
    </ul>
  );
}
