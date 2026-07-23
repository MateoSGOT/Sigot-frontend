import React from 'react';
import './Skeleton.css';

/**
 * Bloque de carga con shimmer. Debe tener la forma del contenido que llega.
 * width/height admiten número (px) o string ('100%', '6rem').
 */
export default function Skeleton({ width = '100%', height = 14, radius, className = '', style = {} }) {
  return (
    <span
      className={`skeleton ${className}`}
      aria-hidden="true"
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: radius ?? 'var(--radius-sm)',
        ...style,
      }}
    />
  );
}

/** Filas de tabla fantasma, del alto real (48px). Refleja el nº de columnas. */
export function TableSkeleton({ columns = 5, rows = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="table__row table__row--skeleton">
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className="table__td">
              <Skeleton width={c === 0 ? '40%' : c === columns - 1 ? '60%' : `${60 + ((r + c) % 3) * 12}%`} height={12} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
