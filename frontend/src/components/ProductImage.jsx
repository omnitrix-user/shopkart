import { useState } from 'react';

/** Product photo with a neutral placeholder if the image URL fails to load. */
export default function ProductImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`product-image product-image--fallback ${className}`} role="img" aria-label={alt}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5a1.5 1.5 0 1 0 0-.01" />
        </svg>
      </div>
    );
  }

  return (
    <img
      className={`product-image ${className}`}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
