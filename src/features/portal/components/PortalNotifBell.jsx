import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdNotifications } from 'react-icons/md';
import api from '../../../shared/services/api.js';
import { formatDate, formatHora12 } from '../../../shared/utils/helpers.js';
import '../../../shared/components/NovedadAlertBell/NovedadAlertBell.css';

const VISTAS_KEY = 'sigot_portal_notif_vistas';

const leerVistas = () => {
  try { return new Set(JSON.parse(localStorage.getItem(VISTAS_KEY) || '[]')); }
  catch { return new Set(); }
};
const guardarVistas = (set) => {
  try { localStorage.setItem(VISTAS_KEY, JSON.stringify([...set])); } catch { /* localStorage puede fallar (privado, cuota) -- no es crítico */ }
};

// Campana de notificaciones para el cliente (mismo patrón que NovedadAlertBell de staff):
// resume sus propios eventos -- cita confirmada/cancelada, orden lista -- para que no
// dependa solo de revisar el correo. No hay tabla de notificaciones en el backend: se arma
// a partir de sus propias citas/órdenes (ya expuestas por /api/portal/*), marcando como
// "vistas" localmente (por dispositivo) las que ya se le mostraron una vez.
export default function PortalNotifBell({ onNavigate }) {
  const [items, setItems]     = useState([]);
  const [open, setOpen]       = useState(false);
  const [pos, setPos]         = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropdownRef = useRef(null);

  // Solo interesan eventos de la última semana -- pasado ese tiempo se
  // consideran "vencidos" y se dejan de mostrar (no hay que limpiar nada a
  // mano, es un filtro por fecha en cada carga).
  const haceUnaSemanaOMenos = (fecha) => {
    if (!fecha) return true;
    const f = new Date(String(fecha).split('T')[0] + 'T12:00:00');
    if (Number.isNaN(f.getTime())) return true;
    const unaSemanaMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - f.getTime() <= unaSemanaMs;
  };

  const cargar = async () => {
    try {
      const [rCitas, rOrdenes] = await Promise.all([
        api.get('/api/portal/citas'),
        api.get('/api/portal/ordenes'),
      ]);
      const citas   = rCitas.data?.data   || rCitas.data   || [];
      const ordenes = rOrdenes.data?.data || rOrdenes.data || [];

      const eventos = [];
      citas.forEach(c => {
        const id = c.Id_Agenda ?? c.id;
        const estado = c.EstadoCita || 'Pendiente';
        if (!haceUnaSemanaOMenos(c.FechaAgendamiento)) return;
        if (estado === 'Confirmada') {
          eventos.push({ key: `cita-${id}-confirmada`, texto: `Tu cita del ${formatDate(c.FechaAgendamiento)} a las ${formatHora12(c.Hora)} fue confirmada.`, tab: 'citas' });
        } else if (estado === 'Cancelada') {
          eventos.push({ key: `cita-${id}-cancelada`, texto: `Tu cita del ${formatDate(c.FechaAgendamiento)} fue cancelada.`, tab: 'citas' });
        }
      });
      ordenes.forEach(o => {
        const id = o.Id_Orden;
        const fechaRef = o.FechaEntrega || o.FechaIngreso;
        if (!haceUnaSemanaOMenos(fechaRef)) return;
        if (Number(o.Estado) === 3) {
          eventos.push({ key: `orden-${id}-realizado`, texto: `Tu orden #${id} (${o.Vehiculo || o.vehiculo || ''}) está lista para recoger.`, tab: 'ordenes' });
        } else if (Number(o.Estado) === 2) {
          eventos.push({ key: `orden-${id}-proceso`, texto: `Tu orden #${id} (${o.Vehiculo || o.vehiculo || ''}) ya está siendo atendida.`, tab: 'ordenes' });
        }
      });

      const vistas = leerVistas();
      setItems(eventos.map(e => ({ ...e, nuevo: !vistas.has(e.key) })));
    } catch { /* silencioso -- no bloquea el resto del portal */ }
  };

  useEffect(() => { cargar(); }, []);

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
      // Al abrir se marcan todas como vistas -- el punto rojo no vuelve a
      // aparecer para las mismas hasta que cambien de estado otra vez.
      const vistas = leerVistas();
      items.forEach(i => vistas.add(i.key));
      guardarVistas(vistas);
      setItems(prev => prev.map(i => ({ ...i, nuevo: false })));
    }
    setOpen(o => !o);
  };

  const count = items.filter(i => i.nuevo).length;

  const dropdown = open && createPortal(
    <div className="novedad-bell__dropdown" ref={dropdownRef} style={{ top: pos.top, left: pos.left }}>
      <div className="novedad-bell__header">
        <MdNotifications size={16} />
        <span>Notificaciones ({items.length})</span>
      </div>
      {items.length === 0 && <div className="novedad-bell__empty">Sin notificaciones por ahora</div>}
      {items.map(item => (
        <div
          key={item.key}
          className="novedad-bell__item"
          style={onNavigate && item.tab ? { cursor: 'pointer' } : undefined}
          onClick={onNavigate && item.tab ? () => { setOpen(false); onNavigate(item.tab); } : undefined}
        >
          <span className="novedad-bell__item-desc">{item.texto}</span>
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
