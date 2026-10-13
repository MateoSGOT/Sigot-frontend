import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { MdNotificationsActive, MdWarning } from 'react-icons/md';
import api from '../../services/api.js';
import { todayLocalYMD } from '../../utils/helpers.js';
import Skeleton from '../Skeleton/Skeleton.jsx';
import './NovedadAlertBell.css';

// Una novedad sigue "vigente" si su fecha de fin (FechaRealizacion, o Fecha_Novedad si no
// tiene fin) es hoy o posterior. Las ya vencidas no deben aparecer en la campana.
const esNovedadVigente = (n) => {
  const fin = (n.FechaRealizacion || n.Fecha_Novedad || '').split('T')[0];
  return !fin || fin >= todayLocalYMD();
};

// Campana de novedades activas para Administrador/Super Administrador -- mismo patrón
// que StockAlertBell (fetch al montar, dropdown en portal, click navega a la lista).
// Incluye las novedades que el sistema crea automáticamente (ej. al desactivar un
// empleado que aún tiene citas pendientes/confirmadas asignadas, ver
// empleado.service.js::toggleEstado) además de las creadas manualmente.
/* Mismo tope que la campana de stock y por la misma razon: el panel es una
   vista previa, no el listado. Sin el, una lista larga se sale de la pantalla y
   deja su propio boton de "ver mas" fuera de alcance. */
const MAX_PREVIO = 5;

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
      // Solo novedades activas Y aún vigentes (las vencidas dejan de aparecer).
      setItems(data.filter(n => (n.Estado === true || n.Estado === 1) && esNovedadVigente(n)));
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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // En pantallas angostas, anclar el dropdown al `left` del botón (que suele estar
  // pegado a la derecha del header) lo sacaba del viewport -- se recorta el ancho
  // y se desplaza hacia la izquierda lo necesario para que quepa completo.
  const recalcPos = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setPos({ top: r.bottom + 8, left });
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
  const previo = items.slice(0, MAX_PREVIO);
  const hayMas = count > MAX_PREVIO;

  const dropdown = open && createPortal(
    <div className="novedad-bell__dropdown" ref={dropdownRef} style={{ top: pos.top, left: pos.left }}>
      <div className="novedad-bell__header">
        <MdWarning size={16} />
        <span>Novedades activas ({count})</span>
      </div>
      {/* Franja desplazable; cabecera y pie quedan fuera (ver el CSS). */}
      <div className="novedad-bell__lista">
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
      {!loading && previo.map(item => (
        <div
          key={item.Id_Novedad}
          className="novedad-bell__item"
          onClick={() => { setOpen(false); navigate('/novedades'); }}
        >
          <span className="novedad-bell__item-empleado">{item.empleado || 'Sin asignar'}</span>
          <span className="novedad-bell__item-desc">{item.Descripcion}</span>
        </div>
      ))}
      </div>
      {count > 0 && (
        <button className="novedad-bell__ver-todos" onClick={() => { setOpen(false); navigate('/novedades'); }}>
          {hayMas ? `Ver más (${count}) en Novedades →` : 'Ver todas en Novedades →'}
        </button>
      )}
    </div>,
    document.body
  );

  return (
    <div className="novedad-bell">
      <button
        ref={btnRef}
        /* Misma campana que StockAlertBell: 34x34 y mismo remedio. */
        className={`novedad-bell__btn max-lg:min-h-[44px] max-lg:min-w-[44px] ${count > 0 ? 'novedad-bell__btn--alert' : ''}`}
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
