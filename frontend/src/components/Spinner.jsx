export default function Spinner({ size = 'sm' }) {
  return <span className={`spinner spinner--${size}`} aria-hidden="true" />;
}
