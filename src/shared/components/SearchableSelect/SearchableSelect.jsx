import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MdSearch } from 'react-icons/md';
import './SearchableSelect.css';

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Seleccionar...',
  labelKey = 'label',
  valueKey = 'value',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selectedOpt = options.find(o => String(o[valueKey]) === String(value));
  const displayLabel = selectedOpt ? String(selectedOpt[labelKey]) : '';

  const filtered = query.trim()
    ? options.filter(o => String(o[labelKey]).toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
        setActiveIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) { setQuery(''); setActiveIdx(-1); }
    else setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const item = listRef.current.children[activeIdx];
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  const handleSelect = useCallback((opt) => {
    onChange(opt[valueKey]);
    setOpen(false);
    setQuery('');
    setActiveIdx(-1);
  }, [onChange, valueKey]);

  const handleKeyDown = (e) => {
    if (!open) { if (e.key === 'Enter' || e.key === ' ') setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { if (activeIdx >= 0 && filtered[activeIdx]) handleSelect(filtered[activeIdx]); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  return (
    <div
      className={`ss${open ? ' ss--open' : ''}${disabled ? ' ss--disabled' : ''}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="ss__trigger form-control"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
      >
        <span className={`ss__value${!displayLabel ? ' ss__value--placeholder' : ''}`}>
          {displayLabel || placeholder}
        </span>
        <span className="ss__arrow">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="ss__dropdown">
          <div className="ss__search-wrap">
            <MdSearch size={15} className="ss__search-icon" />
            <input
              ref={inputRef}
              className="ss__search-input"
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIdx(-1); }}
              placeholder="Buscar..."
              autoComplete="off"
            />
          </div>
          <ul className="ss__list" ref={listRef}>
            {filtered.length === 0 ? (
              <li className="ss__empty">Sin resultados</li>
            ) : (
              filtered.map((opt, idx) => (
                <li
                  key={opt[valueKey]}
                  className={`ss__option${String(opt[valueKey]) === String(value) ? ' ss__option--selected' : ''}${idx === activeIdx ? ' ss__option--active' : ''}`}
                  onMouseDown={() => handleSelect(opt)}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  {opt[labelKey]}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
