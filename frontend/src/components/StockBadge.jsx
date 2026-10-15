import { stockLabel } from '../utils/format.js';

export default function StockBadge({ stock }) {
  const { text, tone } = stockLabel(stock);
  return <span className={`stock-badge stock-badge--${tone}`}>{text}</span>;
}
