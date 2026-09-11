import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { MdNotifications } from 'react-icons/md';
import api from '../../services/api.js';
import '../NovedadAlertBell/NovedadAlertBell.css';

// Campana de notificaciones del taller (panel). Lee la tabla de notificaciones del backend
// (audiencia 'staff'): hoy la alimenta la respuesta del cliente a una observación
// (aprobó/rechazó el trabajo). Mismo patrón visual que NovedadAlertBell/StockAlertBell.
// Al abrir marca todas como leídas y, al hacer clic, navega a la orden en cuestión.
const _fechaCorta = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

export default function StaffNotifBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen]   = useState(false);
  const [pos, setPos]     = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropdownRef = useRef(null);

  const cargar = async () => {
    try {
      const r = await api.get('/api/notificaciones');
      const rows = r.data?.data || r.data || [];
      setItems(Array.isArray(rows) ? rows : []);
    } catch { /* silencioso */ }
  };

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (dropdownRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const recalcPos = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: r.left });
  };

  useEffect(() => {
    if (!open) return;
    recalcPos();
    window.addEventListener('resize', recalcPos);
    window.addEventListener('scroll', recalcPos, true);
    return () => {
      window.removeEventListener('resize', recalcPos);
      window.removeEventListener('scroll', recalcPos, true);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      recalcPos();
      if (items.some(i => !i.Leida)) {
        setItems(prev => prev.map(i => ({ ...i, Leida: true })));
        api.patch('/api/notificaciones/leidas').catch(() => {});
      }
    }
    setOpen(o => !o);
  };

  const count = items.filter(i => !i.Leida).length;

  const dropdown = open && createPortal(
    <div className="novedad-bell__dropdown" ref={dropdownRef} style={{ top: pos.top, left: pos.left }}>
      <div className="novedad-bell__header">
        <MdNotifications size={16} />
        <span>Notificaciones ({items.length})</span>
      </div>
      {items.length === 0 && <div className="novedad-bell__empty">Sin notificaciones por ahora</div>}
      {items.map(item => (
        <div
          key={item.Id_Notificacion}
          className={`novedad-bell__item${!item.Leida ? ' novedad-bell__item--nuevo' : ''}`}
          style={item.Id_Orden ? { cursor: 'pointer' } : undefined}
          onClick={item.Id_Orden ? () => { setOpen(false); navigate('/ordenes'); } : undefined}
        >
          {item.Titulo && <span className="novedad-bell__item-titulo">{item.Titulo}</span>}
          <span className="novedad-bell__item-desc">{item.Mensaje}</span>
          <span className="novedad-bell__item-fecha">{_fechaCorta(item.createdAt)}</span>
        </div>
      ))}
    </div>,
    document.body
  );

  return (
    <div className="novedad-bell">
      <button
        ref={btnRef}
        className={`novedad-bell__btn ${count > 0 ? 'novedad-bell__btn--alert' : ''}`}
        onClick={toggle}
        title="Notificaciones"
      >
        <MdNotifications size={20} />
        {count > 0 && <span className="novedad-bell__badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {dropdown}
    </div>
  );
}
