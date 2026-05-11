import React from 'react';
import './Badge.css';

const VARIANTS = {
  success: 'badge--success',
  danger: 'badge--danger',
  warning: 'badge--warning',
  info: 'badge--info',
  default: 'badge--default',
  gray: 'badge--gray',
};

export default function Badge({ children, variant = 'default' }) {
  return (
    <span className={`badge ${VARIANTS[variant] || VARIANTS.default}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ estado }) {
  const isActive = estado === 1 || estado === undefined;
  return (
    <Badge variant={isActive ? 'success' : 'gray'}>
      {isActive ? 'Activo' : 'Inactivo'}
    </Badge>
  );
}
