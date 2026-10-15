import axios from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

/**
 * Shared Axios instance. withCredentials makes the browser send and accept the
 * HttpOnly auth cookie; the token itself is never readable from JavaScript.
 */
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export class ApiError extends Error {
  constructor(message, { status = 0, fieldErrors = {}, canceled = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.canceled = canceled;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  /** Network failures, timeouts and 5xx responses are worth retrying. */
  get isRecoverable() {
    return this.status === 0 || this.status >= 500;
  }
}

const FALLBACK_MESSAGES = {
  400: 'Please check the details you entered.',
  401: 'You are not logged in.',
  404: 'The requested resource was not found.',
  409: 'This record already exists.',
  413: 'The request was too large.',
  503: 'ShopKart is temporarily unavailable. Please try again shortly.',
};

function toApiError(error) {
  if (axios.isCancel(error)) {
    return new ApiError('Request canceled', { canceled: true });
  }

  if (error.response) {
    const { status, data } = error.response;
    const message =
      (data && typeof data.message === 'string' && data.message) ||
      FALLBACK_MESSAGES[status] ||
      'Something went wrong on our side. Please try again later.';
    return new ApiError(message, { status, fieldErrors: data?.errors || {} });
  }

  if (error.code === 'ECONNABORTED') {
    return new ApiError('The server took too long to respond. Please try again.');
  }

  return new ApiError(
    'Unable to reach the ShopKart server. Check your internet connection and make sure the API is running.',
  );
}

async function send(promise) {
  try {
    const response = await promise;
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export const registerCustomer = (details) => send(api.post('/customers/register', details));

export const loginCustomer = (credentials) => send(api.post('/customers/login', credentials));

export const fetchCurrentCustomer = ({ signal } = {}) => send(api.get('/customers/me', { signal }));

export const logoutCustomer = () => send(api.post('/customers/logout'));

export const changePassword = (passwords) => send(api.patch('/customers/change-password', passwords));

// ---- Products ----
export const fetchProducts = ({ search, category } = {}, { signal } = {}) =>
  send(api.get('/products', { params: { search: search || undefined, category: category || undefined }, signal }));

export const fetchProduct = (id, { signal } = {}) => send(api.get(`/products/${encodeURIComponent(id)}`, { signal }));

// ---- Wishlist (always the logged-in customer's; identified by the cookie) ----
export const fetchWishlist = ({ signal } = {}) => send(api.get('/wishlist', { signal }));

export const addToWishlist = (productId) => send(api.post(`/wishlist/${encodeURIComponent(productId)}`));

export const removeFromWishlist = (productId) => send(api.delete(`/wishlist/${encodeURIComponent(productId)}`));

export const toggleWishlist = (productId) => send(api.patch(`/wishlist/${encodeURIComponent(productId)}/toggle`));

// ---- Cart ----
export const fetchCart = ({ signal } = {}) => send(api.get('/cart', { signal }));

export const addToCart = (productId) => send(api.post(`/cart/${encodeURIComponent(productId)}`));

export const updateCartItem = (productId, quantity) =>
  send(api.patch(`/cart/${encodeURIComponent(productId)}`, { quantity }));

export const removeCartItem = (productId) => send(api.delete(`/cart/${encodeURIComponent(productId)}`));

// ---- Orders & payments ----
/** Only the shipping address is sent: the server prices the order from the database. */
export const createPaymentOrder = (shippingAddress) =>
  send(api.post('/orders/create-payment-order', { shippingAddress }));

export const verifyPayment = (payload) => send(api.post('/orders/verify-payment', payload));

export const reportPaymentFailed = (orderId) => send(api.post(`/orders/${encodeURIComponent(orderId)}/payment-failed`));

export const fetchOrders = ({ signal } = {}) => send(api.get('/orders', { signal }));

export const fetchOrder = (id, { signal } = {}) => send(api.get(`/orders/${encodeURIComponent(id)}`, { signal }));

export const advanceOrderStatus = (id, status) =>
  send(api.patch(`/orders/${encodeURIComponent(id)}/status`, { status }));

export default api;
