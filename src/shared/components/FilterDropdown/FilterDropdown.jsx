import React, { useState, useRef, useEffect } from 'react';
import { MdTune, MdKeyboardArrowDown, MdCheck } from 'react-icons/md';
import './FilterDropdown.css';

const PAGE_OPTIONS = [5, 10, 25, 50];

const STATUS_OPTIONS = [
  { value: 'todos',    label: 'Todos' },
  { value: 'activos',  label: 'Activos' },
  { value: 'inactivos',label: 'Inactivos' },
];

export default function FilterDropdown({
  statusFilter = 'todos',
  onStatusChange,
  pageSize = 10,
  onPageSizeChange,
  statusOptions,
  // showStatus=false → el dropdown solo controla "registros por página"
  // (útil donde el estado se filtra con otro control, p. ej. Órdenes).
  showStatus = true,
}) {
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeOptions = statusOptions || STATUS_OPTIONS;
  const defaultStatus = activeOptions[0]?.value;
  const selectedStatus = activeOptions.find(o => o.value === statusFilter);
  // El botón ya no "anuncia" el estado por defecto ("Todos"): solo muestra una
  // etiqueta cuando hay un filtro real aplicado; si no, dice "Filtros".
  const triggerLabel = (showStatus && selectedStatus && statusFilter !== defaultStatus)
    ? selectedStatus.label
    : 'Filtros';

  const applyCustom = () => {
    const n = parseInt(customValue, 10);
    if (n > 0) {
      onPageSizeChange(n);
      setCustomValue('');
      setOpen(false);
    }
  };

  return (
    <div className="fdd" ref={ref}>
      <button
        className={`fdd__trigger${open ? ' fdd__trigger--open' : ''}`}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <MdTune size={15} />
        <span>{triggerLabel}</span>
        <MdKeyboardArrowDown
          size={14}
          className={`fdd__arrow${open ? ' fdd__arrow--open' : ''}`}
        />
      </button>

      {open && (
        <div className="fdd__panel">
          {/* Section 1: Status (opcional) */}
          {showStatus && (
            <>
              <div className="fdd__section">
                <p className="fdd__section-title">Estado</p>
                {activeOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`fdd__item${statusFilter === opt.value ? ' fdd__item--active' : ''}`}
                    onClick={() => onStatusChange(opt.value)}
                  >
                    {opt.label}
                    {statusFilter === opt.value && <MdCheck size={14} className="fdd__item-check" />}
                  </button>
                ))}
              </div>

              <div className="fdd__divider" />
            </>
          )}

          {/* Section 2: Page size */}
          <div className="fdd__section">
            <p className="fdd__section-title">Registros por página</p>
            <div className="fdd__chips">
              {PAGE_OPTIONS.map(size => (
                <button
                  key={size}
                  type="button"
                  className={`fdd__chip${pageSize === size ? ' fdd__chip--active' : ''}`}
                  onClick={() => { onPageSizeChange(size); setCustomValue(''); }}
                >
                  {size}
                </button>
              ))}
              <button
                type="button"
                className={`fdd__chip${pageSize === 'all' ? ' fdd__chip--active' : ''}`}
                onClick={() => { onPageSizeChange('all'); setCustomValue(''); }}
              >
                Todos
              </button>
            </div>
            <div className="fdd__custom">
              <span className="fdd__custom-label">Otro:</span>
              <input
                type="number"
                className="fdd__custom-input"
                placeholder="N°"
                value={customValue}
                min="1"
                max="500"
                onChange={e => setCustomValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyCustom()}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
