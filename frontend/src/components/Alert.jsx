const ICONS = {
  error: (
    <path d="M12 8v5m0 3.5h.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  ),
  success: <path d="m8.5 12.5 2.5 2.5 5-5.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  info: <path d="M12 16v-4.5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
};

/** Inline status message. Errors are announced immediately to screen readers. */
export default function Alert({ tone = 'info', children }) {
  if (!children) return null;

  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <svg className="alert__icon" viewBox="0 0 24 24" aria-hidden="true">
        {ICONS[tone]}
      </svg>
      <div>{children}</div>
    </div>
  );
}
