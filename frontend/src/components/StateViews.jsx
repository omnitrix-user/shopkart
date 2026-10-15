import { Link } from 'react-router-dom';
import Spinner from './Spinner.jsx';
import Alert from './Alert.jsx';

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="state-view" role="status" aria-live="polite">
      <Spinner size="lg" />
      <p className="muted">{label}</p>
    </div>
  );
}

export function EmptyState({ icon = '🛍️', title, message, actionLabel, actionTo }) {
  return (
    <div className="state-view card">
      <span className="state-view__icon" aria-hidden="true">
        {icon}
      </span>
      <h2 className="state-view__title">{title}</h2>
      {message && <p className="muted">{message}</p>}
      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn btn--primary">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="state-view card">
      <h2 className="state-view__title">{title}</h2>
      <Alert tone="error">{message}</Alert>
      {onRetry && (
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}
