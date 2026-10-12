/** ShopKart wordmark: a shopping-bag mark with a "K" monogram. */
export default function Logo({ inverted = false }) {
  return (
    <span className={`logo${inverted ? ' logo--inverted' : ''}`}>
      <svg className="logo__mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="logo__tile" />
        <path d="M11.5 12V10.5a4.5 4.5 0 0 1 9 0V12" className="logo__handle" />
        <path d="M8.6 12.5h14.8l-1.2 11.2a2 2 0 0 1-2 1.8h-8.4a2 2 0 0 1-2-1.8z" className="logo__bag" />
        <path d="M13 16.5v5.5M13 19.4l3.6-2.9M14.6 18.2l2.8 3.8" className="logo__k" />
      </svg>
      <span className="logo__text">
        Shop<span className="logo__accent">Kart</span>
      </span>
    </span>
  );
}
