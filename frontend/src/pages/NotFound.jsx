import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function NotFound() {
  const { status, verifySession } = useAuth();
  const statusOnMount = useRef(status);

  useEffect(() => {
    if (statusOnMount.current !== 'unknown') return undefined;
    const controller = new AbortController();
    verifySession(controller.signal);
    return () => controller.abort();
  }, [verifySession]);

  return (
    <section className="container status-page" aria-labelledby="not-found-title">
      <div className="card status-card">
        <p className="status-card__code">404</p>
        <h1 id="not-found-title" className="status-card__title">
          This page is out of stock
        </h1>
        <p className="muted">The page you are looking for doesn’t exist or has moved.</p>
        <Link to="/products" className="btn btn--primary">
          Browse Products
        </Link>
      </div>
    </section>
  );
}
