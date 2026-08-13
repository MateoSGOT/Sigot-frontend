import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { MdNotificationsActive, MdWarning } from 'react-icons/md';
import api from '../../services/api.js';
import Skeleton from '../Skeleton/Skeleton.jsx';
import './NovedadAlertBell.css';

// Campana de novedades activas para Administrador/Super Administrador -- mismo patrón
// que StockAlertBell (fetch al montar, dropdown en portal, click navega a la lista).
// Incluye las novedades que el sistema crea automáticamente (ej. al desactivar un
// empleado que aún tiene citas pendientes/confirmadas asignadas, ver
// empleado.service.js::toggleEstado) además de las creadas manualmente.
export default function NovedadAlertBell() {
  const navigate = useNavigate();
  const [items, setItems]     = useState([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [pos, setPos]         = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropdownRef = useRef(null);

  const fetchNovedades = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/novedades');
      const data = r.data?.data || [];
      setItems(data.filter(n => n.Estado === true || n.Estado === 1));
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNovedades(); }, []);

  useEffect(() => {
    const handler = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (dropdownRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    if (!open) recalcPos();
    setOpen(o => !o);
  };

  const count = items.length;

  const dropdown = open && createPortal(
    <div className="novedad-bell__dropdown" ref={dropdownRef} style={{ top: pos.top, left: pos.left }}>
      <div className="novedad-bell__header">
        <MdWarning size={16} />
        <span>Novedades activas ({count})</span>
      </div>
      {loading && (
        <div className="novedad-bell__loading">
          {[0, 1, 2].map(i => (
            <div key={i} className="novedad-bell__skeleton-row">
              <Skeleton width="70%" height={11} />
              <Skeleton width="40%" height={10} />
            </div>
          ))}
        </div>
      )}
      {!loading && count === 0 && <div className="novedad-bell__empty">Sin novedades activas</div>}
      {!loading && items.map(item => (
        <div
          key={item.Id_Novedad}
          className="novedad-bell__item"
          onClick={() => { setOpen(false); navigate('/novedades'); }}
        >
          <span className="novedad-bell__item-empleado">{item.empleado || 'Sin asignar'}</span>
          <span className="novedad-bell__item-desc">{item.Descripcion}</span>
        </div>
      ))}
      {count > 0 && (
        <button className="novedad-bell__ver-todos" onClick={() => { setOpen(false); navigate('/novedades'); }}>
          Ver todas en Novedades →
        </button>
      )}
    </div>,
    document.body
  );

  return (
    <div className="novedad-bell">
      <button
        ref={btnRef}
        className={`novedad-bell__btn ${count > 0 ? 'novedad-bell__btn--alert' : ''}`}
        onClick={toggle}
        title="Novedades activas"
      >
        <MdNotificationsActive size={20} />
        {count > 0 && <span className="novedad-bell__badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {dropdown}
    </div>
  );
}
