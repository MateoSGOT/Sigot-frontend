import React, { useState, useRef, useEffect } from 'react';
import './ComboboxSelect.css';

export default function ComboboxSelect({ options = [], value, onChange, placeholder = 'Seleccionar...', disabled }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    const handleClickOutside = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange(option);
    setQuery('');
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setOpen(false);
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setOpen(true);
  };

  const displayValue = open ? query : (value || '');

  return (
    <div className="combobox" ref={containerRef}>
      <div className={`combobox__control form-control${open ? ' combobox__control--open' : ''}`}
        onClick={() => { if (!disabled) setOpen(o => !o); }}
      >
        <input
          className="combobox__input"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => { if (!disabled) setOpen(true); }}
          placeholder={value ? '' : placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        {value && !disabled && (
          <button type="button" className="combobox__clear" onClick={handleClear} tabIndex={-1}>×</button>
        )}
        <span className={`combobox__arrow${open ? ' combobox__arrow--up' : ''}`}>▾</span>
      </div>

      {open && (
        <ul className="combobox__list">
          {filtered.length === 0 ? (
            <li className="combobox__empty">Sin resultados</li>
          ) : (
            filtered.map(opt => (
              <li
                key={opt}
                className={`combobox__option${opt === value ? ' combobox__option--selected' : ''}`}
                onMouseDown={() => handleSelect(opt)}
              >
                {opt}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
