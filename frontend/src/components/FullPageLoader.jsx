import Spinner from './Spinner.jsx';

export default function FullPageLoader({ label = 'Loading…' }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <Spinner size="lg" />
      <p>{label}</p>
    </div>
  );
}
