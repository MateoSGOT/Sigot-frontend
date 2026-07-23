import React from 'react';
import './EmptyState.css';

/* Ilustraciones SVG propias (stroke = currentColor), no emojis. */
function InboxArt() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 34 L18 16 h28 l8 18" />
      <path d="M10 34 v14 a2 2 0 0 0 2 2 h40 a2 2 0 0 0 2-2 V34" />
      <path d="M10 34 h12 l4 6 h12 l4-6 h12" />
    </svg>
  );
}

function SearchArt() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="28" cy="28" r="14" />
      <path d="M38 38 L52 52" />
      <path d="M22.5 33.5 L33.5 22.5" />
    </svg>
  );
}

/**
 * Estado vacío con propósito: ilustración + explicación + acción concreta.
 * variant: 'empty' (aún no hay datos) | 'no-results' (búsqueda sin coincidencias)
 */
export default function EmptyState({
  variant = 'empty',
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) {
  const art = icon || (variant === 'no-results' ? <SearchArt /> : <InboxArt />);
  return (
    <div className="empty-state" role="status">
      <div className="empty-state__art">{art}</div>
      {title && <h3 className="empty-state__title">{title}</h3>}
      {description && <p className="empty-state__desc">{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className="btn btn--primary btn--sm empty-state__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
