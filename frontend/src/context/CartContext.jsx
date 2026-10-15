import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import {
  addToCart as addToCartRequest,
  fetchCart,
  removeCartItem,
  updateCartItem,
} from '../services/api.js';

const CartContext = createContext(null);

const initialState = {
  cartItems: [],
  loading: false,
  loaded: false,
  error: null,
  pending: {}, // productId -> 'add' | 'update' | 'remove'
};

function cartReducer(state, action) {
  switch (action.type) {
    case 'load/start':
      return { ...state, loading: true, error: null };
    case 'load/success':
      return { ...state, loading: false, loaded: true, error: null, cartItems: action.cart };
    case 'load/failure':
      return { ...state, loading: false, error: action.error };
    case 'item/start':
      return { ...state, pending: { ...state.pending, [action.productId]: action.operation } };
    case 'item/success': {
      const { [action.productId]: _done, ...pending } = state.pending;
      return { ...state, pending, loaded: true, error: null, cartItems: action.cart };
    }
    case 'item/finish': {
      const { [action.productId]: _done, ...pending } = state.pending;
      return { ...state, pending };
    }
    case 'clear':
      return { ...state, cartItems: [] };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

/**
 * Global cart state. The backend cart is the source of truth: every change is sent to
 * the API and the cart it returns replaces local state. Count and subtotal are derived.
 */
export function CartProvider({ children }) {
  const { status, markSignedOut } = useAuth();
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const latestLoad = useRef(0);

  const handleUnauthorized = useCallback(
    (error) => {
      if (error?.isUnauthorized) markSignedOut('session');
    },
    [markSignedOut],
  );

  const refreshCart = useCallback(async () => {
    const loadId = ++latestLoad.current;
    dispatch({ type: 'load/start' });
    try {
      const { cart } = await fetchCart();
      if (loadId === latestLoad.current) dispatch({ type: 'load/success', cart });
    } catch (error) {
      if (loadId !== latestLoad.current) return;
      dispatch({ type: 'load/failure', error });
      handleUnauthorized(error);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    if (status === 'authenticated') {
      refreshCart();
    } else if (status === 'unauthenticated') {
      latestLoad.current += 1;
      dispatch({ type: 'reset' });
    }
  }, [status, refreshCart]);

  /** Runs one cart mutation; rejects with the ApiError so callers can show it inline. */
  const mutate = useCallback(
    async (productId, operation, request) => {
      dispatch({ type: 'item/start', productId, operation });
      try {
        const { cart } = await request();
        latestLoad.current += 1; // a newer cart supersedes any in-flight refresh
        dispatch({ type: 'item/success', productId, cart });
        return cart;
      } catch (error) {
        dispatch({ type: 'item/finish', productId });
        handleUnauthorized(error);
        throw error;
      }
    },
    [handleUnauthorized],
  );

  const addToCart = useCallback(
    (productId) => mutate(productId, 'add', () => addToCartRequest(productId)),
    [mutate],
  );
  const updateQuantity = useCallback(
    (productId, quantity) => mutate(productId, 'update', () => updateCartItem(productId, quantity)),
    [mutate],
  );
  const removeFromCart = useCallback(
    (productId) => mutate(productId, 'remove', () => removeCartItem(productId)),
    [mutate],
  );

  /** Empties local state immediately (after a verified payment), then syncs with the server. */
  const clearAfterOrder = useCallback(() => {
    latestLoad.current += 1;
    dispatch({ type: 'clear' });
    refreshCart();
  }, [refreshCart]);

  const value = useMemo(() => {
    const cartCount = state.cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    return {
      ...state,
      cartCount,
      subtotal,
      addToCart,
      updateQuantity,
      removeFromCart,
      refreshCart,
      clearAfterOrder,
    };
  }, [state, addToCart, updateQuantity, removeFromCart, refreshCart, clearAfterOrder]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside <CartProvider>.');
  }
  return context;
}
