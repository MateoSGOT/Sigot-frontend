import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
  // El buscador solo aparece cuando la lista es larga; en catálogos cortos
  // (tipo de documento, rol, estado…) sobra, así que se oculta.
  searchThreshold = 8,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  // Posición del dropdown (se renderiza en un portal en <body> con position:fixed
  // para que NO lo recorte el overflow del modal y quede por encima de todo).
  const [pos, setPos] = useState(null);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selectedOpt = options.find(o => String(o[valueKey]) === String(value));
  const displayLabel = selectedOpt ? String(selectedOpt[labelKey]) : '';

  const showSearch = options.length > searchThreshold;

  const filtered = query.trim()
    ? options.filter(o => String(o[labelKey]).toLowerCase().includes(query.toLowerCase()))
    : options;

  const computePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  // Cierre al hacer clic fuera. Consideramos tanto el contenedor (trigger) como
  // el dropdown del portal, porque este vive fuera del contenedor en el DOM.
  useEffect(() => {
    const handler = (e) => {
      const inContainer = containerRef.current?.contains(e.target);
      const inDropdown = dropdownRef.current?.contains(e.target);
      if (!inContainer && !inDropdown) { setOpen(false); setQuery(''); setActiveIdx(-1); }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  // Posicionar al abrir y reposicionar si se hace scroll o cambia el tamaño.
  useLayoutEffect(() => { if (open) computePos(); }, [open, computePos]);
  useEffect(() => {
    if (!open) return;
    const onMove = () => computePos();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => { window.removeEventListener('scroll', onMove, true); window.removeEventListener('resize', onMove); };
  }, [open, computePos]);

  useEffect(() => {
    if (!open) { setQuery(''); setActiveIdx(-1); }
    else if (showSearch) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, showSearch]);

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
        ref={triggerRef}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
      >
        <span className={`ss__value${!displayLabel ? ' ss__value--placeholder' : ''}`}>
          {displayLabel || placeholder}
        </span>
        <span className="ss__arrow">{open ? '▴' : '▾'}</span>
      </button>

      {open && pos && createPortal(
        <div
          className="ss__dropdown ss__dropdown--portal"
          ref={dropdownRef}
          onKeyDown={handleKeyDown}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
        >
          {showSearch && (
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
          )}
          <ul className="ss__list" ref={listRef}>
            {filtered.length === 0 ? (
              <li className="ss__empty">Sin resultados</li>
            ) : (
              filtered.map((opt, idx) => (
                <li
                  key={opt[valueKey]}
                  className={`ss__option${String(opt[valueKey]) === String(value) ? ' ss__option--selected' : ''}${idx === activeIdx ? ' ss__option--active' : ''}`}
                  // pointerup selecciona en mouse y touch; onClick queda de respaldo.
                  onPointerUp={() => handleSelect(opt)}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  {opt[labelKey]}
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
