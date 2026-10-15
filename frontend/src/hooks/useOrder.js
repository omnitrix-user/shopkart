import { useCallback, useEffect, useState } from 'react';
import { fetchOrder } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

/** Loads one of the logged-in customer's orders by id. */
export function useOrder(id) {
  const { markSignedOut } = useAuth();
  const [state, setState] = useState({ status: 'loading', order: null, error: null });

  const load = useCallback(
    async (signal) => {
      setState({ status: 'loading', order: null, error: null });
      try {
        const { order } = await fetchOrder(id, { signal });
        setState({ status: 'ready', order, error: null });
      } catch (error) {
        if (error.canceled) return;
        if (error.isUnauthorized) markSignedOut('session');
        else setState({ status: 'error', order: null, error });
      }
    },
    [id, markSignedOut],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const setOrder = useCallback((order) => setState({ status: 'ready', order, error: null }), []);

  return { ...state, reload: () => load(), setOrder };
}
