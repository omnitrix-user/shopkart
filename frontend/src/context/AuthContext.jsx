import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { fetchCurrentCustomer, logoutCustomer } from '../services/api.js';

const AuthContext = createContext(null);

/**
 * Holds the customer returned by GET /customers/me. The backend is the only authority:
 * status becomes "authenticated" only after the API accepts the session cookie.
 *
 * status: 'unknown' | 'checking' | 'authenticated' | 'unauthenticated' | 'error'
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({
    status: 'unknown',
    customer: null,
    error: null,
    reason: null,
  });
  const latestRequest = useRef(0);

  /** Asks the backend who is logged in. Resolves to false if superseded or aborted. */
  const verifySession = useCallback(async (signal) => {
    const requestId = ++latestRequest.current;
    setState((previous) => ({ ...previous, status: 'checking', error: null }));

    try {
      const customer = await fetchCurrentCustomer({ signal });
      if (requestId !== latestRequest.current) return false;
      setState({ status: 'authenticated', customer, error: null, reason: null });
    } catch (error) {
      if (error.canceled || requestId !== latestRequest.current) return false;
      setState(
        error.isUnauthorized
          ? { status: 'unauthenticated', customer: null, error: null, reason: 'session' }
          : { status: 'error', customer: null, error, reason: null },
      );
    }
    return true;
  }, []);

  const markSignedOut = useCallback((reason = 'session') => {
    latestRequest.current += 1;
    setState({ status: 'unauthenticated', customer: null, error: null, reason });
  }, []);

  /** Calls POST /customers/logout. An already-expired session counts as logged out. */
  const signOut = useCallback(async () => {
    try {
      await logoutCustomer();
    } catch (error) {
      if (!error.isUnauthorized) throw error;
    }
    markSignedOut('logout');
  }, [markSignedOut]);

  const value = useMemo(
    () => ({ ...state, verifySession, markSignedOut, signOut }),
    [state, verifySession, markSignedOut, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}
