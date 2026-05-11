import React from 'react';
import './ToggleSwitch.css';

export default function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle-switch${checked ? ' toggle-switch--on' : ' toggle-switch--off'}${disabled ? ' toggle-switch--disabled' : ''}`}
      onClick={!disabled ? onChange : undefined}
    />
  );
}
