import { formatPrice } from '../utils/format.js';

/** Totals box. Values are derived from the items passed in; nothing here is stored. */
export default function OrderSummary({ itemCount, subtotal, title = 'Order summary', children }) {
  return (
    <section className="card summary-card" aria-labelledby="summary-title">
      <h2 id="summary-title" className="card__title">
        {title}
      </h2>
      <dl className="summary-lines">
        <div>
          <dt>Items</dt>
          <dd>{itemCount}</dd>
        </div>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatPrice(subtotal)}</dd>
        </div>
        <div>
          <dt>Delivery</dt>
          <dd className="text-success">Free</dd>
        </div>
        <div className="summary-lines__total">
          <dt>Total</dt>
          <dd>{formatPrice(subtotal)}</dd>
        </div>
      </dl>
      {children}
    </section>
  );
}
