import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import FullPageLoader from './FullPageLoader.jsx';

/**
 * Wraps the login and register pages. A customer whose session the backend confirms
 * is sent to /home; everyone else (including when the API is unreachable) sees the page.
 */
export default function GuestRoute({ children }) {
  const { status, verifySession } = useAuth();
  const [checked, setChecked] = useState(status === 'unauthenticated');

  useEffect(() => {
    if (checked) return undefined;
    const controller = new AbortController();
    verifySession(controller.signal).then((completed) => {
      if (completed) setChecked(true);
    });
    return () => controller.abort();
  }, [checked, verifySession]);

  if (!checked || status === 'checking') {
    return <FullPageLoader label="Loading…" />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/home" replace />;
  }

  return children;
}
