import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * For public pages: asks the backend who is logged in if nobody has checked yet,
 * so the navbar and buttons can reflect the session without forcing a login.
 */
export function useSessionCheck() {
  const { status, verifySession } = useAuth();
  const statusOnMount = useRef(status);

  useEffect(() => {
    if (statusOnMount.current !== 'unknown') return undefined;
    const controller = new AbortController();
    verifySession(controller.signal);
    return () => controller.abort();
  }, [verifySession]);

  return status;
}
