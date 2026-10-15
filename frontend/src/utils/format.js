const priceFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export const formatPrice = (amount) => priceFormatter.format(Number(amount) || 0);

const dateFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export const formatDate = (value) => dateFormatter.format(new Date(value));
export const formatDateTime = (value) => dateTimeFormatter.format(new Date(value));

/** Short, human-friendly order reference derived from the MongoDB id. */
export const orderReference = (id = '') => `#${String(id).slice(-8).toUpperCase()}`;

export const ORDER_STEPS = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

export const STATUS_LABELS = {
  PENDING_PAYMENT: 'Awaiting payment',
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
};

export const PAYMENT_LABELS = {
  PENDING: 'Payment pending',
  PAID: 'Paid',
  FAILED: 'Payment failed',
};

export function stockLabel(stock) {
  if (stock <= 0) return { text: 'Out of stock', tone: 'out' };
  if (stock <= 3) return { text: `Only ${stock} left`, tone: 'low' };
  return { text: 'In stock', tone: 'in' };
}
