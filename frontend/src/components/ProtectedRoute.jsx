import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import FullPageLoader from './FullPageLoader.jsx';
import Alert from './Alert.jsx';

/**
 * Renders its children only after GET /customers/me confirms the session.
 * Every mount (including a browser refresh) re-checks with the backend.
 */
export default function ProtectedRoute({ children }) {
  const { status, error, reason, verifySession } = useAuth();
  const location = useLocation();
  const [checked, setChecked] = useState(status === 'authenticated');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    verifySession(controller.signal).then((completed) => {
      if (completed) setChecked(true);
    });
    return () => controller.abort();
  }, [verifySession]);

  if (!checked || status === 'checking' || status === 'unknown') {
    return <FullPageLoader label={retrying ? 'Reconnecting…' : 'Checking your session…'} />;
  }

  if (status === 'authenticated') {
    return children;
  }

  if (status === 'error') {
    const retry = async () => {
      setRetrying(true);
      await verifySession();
      setRetrying(false);
    };

    return (
      <section className="container status-page" aria-labelledby="session-error-title">
        <div className="card status-card">
          <h1 id="session-error-title" className="status-card__title">
            We couldn’t load your account
          </h1>
          <Alert tone="error">{error?.message}</Alert>
          <p className="muted">
            This usually means the ShopKart server is unreachable. Your session has not been changed.
          </p>
          <button type="button" className="btn btn--primary" onClick={retry}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  const notice =
    reason === 'logout'
      ? { tone: 'success', text: 'You have been logged out successfully.' }
      : { tone: 'info', text: 'Please log in to continue.' };

  return <Navigate to="/login" replace state={{ from: location.pathname, notice }} />;
}
