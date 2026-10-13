import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  MdNotificationsActive, MdEventNote, MdInventory2,
  MdLocalShipping, MdReceiptLong, MdArrowForward,
} from 'react-icons/md';
import { fetchNotificaciones, marcarNotificacionLeida } from '../../../features/notificaciones/slices/notificacionesSlice.js';
import { META_TIPO, estiloTipo } from '../../styles/clasesNotificaciones.js';
/* Se reusa el CSS de StockAlertBell para el BOTÓN, la insignia y la caja
   flotante, en vez de reproducirlos con utilidades. No es pereza: las tres
   campanas viven en la misma barra oscura y tienen que verse idénticas; con
   cadenas propias, el día que cambie el tamaño del botón cambiaría en una sola.
   Y no añade ni una regla de CSS nueva. El CONTENIDO del panel sí va en
   utilidades de Tailwind, que es donde hay maquetación propia. */
import '../StockAlertBell/StockAlertBell.css';

const ICONO_TIPO = {
  CITAS: MdEventNote,
  STOCK_BAJO: MdInventory2,
  LOGISTICA: MdLocalShipping,
  FACTURACION: MdReceiptLong,
};

/* MÁXIMO en el panel flotante. Es una vista previa, no la lista: cinco filas
   caben sin que el panel se convierta en una columna con scroll propio dentro de
   un dropdown de 280px, que es cuando deja de poder usarse con el pulgar. El
   resto se ve en /notificaciones. */
const MAX_PREVIO = 5;

const fechaCorta = (iso) => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
};

export default function NotificacionesBell() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  /* El contador sale del STORE, no de un estado local: así la campana y la
     página /notificaciones muestran el mismo número y marcar algo como leído
     en la página baja el contador de aquí sin recargar. */
  const { items, noLeidas } = useSelector(s => s.notificaciones);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => { dispatch(fetchNotificaciones({ pageSize: 30 })); }, [dispatch]);

  // Cerrar al pulsar fuera del botón Y fuera del panel (que vive en un portal,
  // fuera del subárbol del sidebar). Mismo patrón que las otras dos campanas.
  useEffect(() => {
    const handler = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
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
    const width = Math.min(320, window.innerWidth - 16);
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

  const irAlListado = () => { setOpen(false); navigate('/notificaciones'); };

  /* PRIMER clic: abre la vista previa. SEGUNDO clic sobre la campana: navega.
     El encargo pedía que el icono de la campana navegara Y que el panel
     mostrara cinco elementos, y las dos cosas no caben en un mismo clic: si el
     icono navega, el panel no se puede abrir nunca. Así quedan las dos: un
     vistazo rápido y, si ya está abierto, la campana lleva al listado completo
     igual que "Ver más". */
  const alPulsarCampana = () => {
    if (open) { irAlListado(); return; }
    recalcPos();
    setOpen(true);
  };

  const abrirNotificacion = (n) => {
    if (!n.Leido) dispatch(marcarNotificacionLeida(n.Id));
    irAlListado();
  };

  const previo = items.slice(0, MAX_PREVIO);
  const hayMas = items.length > MAX_PREVIO;

  const panel = open && createPortal(
    <div
      className="stock-bell__dropdown"
      ref={panelRef}
      style={{ top: pos.top, left: pos.left, width: `min(320px, calc(100vw - 16px))` }}
    >
      <div className="stock-bell__header">
        <MdNotificationsActive size={16} />
        <span>Notificaciones{noLeidas > 0 ? ` (${noLeidas} sin leer)` : ''}</span>
      </div>

      {previo.length === 0 ? (
        <div className="stock-bell__empty">Sin notificaciones</div>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {previo.map(n => {
            const Icono = ICONO_TIPO[n.Tipo] || MdNotificationsActive;
            return (
              <button
                key={n.Id}
                type="button"
                onClick={() => abrirNotificacion(n)}
                /* min-h-[48px] es el mínimo táctil y la fila entera es el
                   objetivo: en un panel de 320px, un botón pequeño al final
                   obliga a apuntar. */
                className={`flex min-h-[48px] w-full items-start gap-sm px-md py-sm text-left transition-colors hover:bg-surface-hover ${n.Leido ? '' : 'bg-primary-wash'}`}
              >
                <span
                  className="flex size-[28px] shrink-0 items-center justify-center rounded-lg border"
                  style={estiloTipo(n.Tipo)}
                >
                  <Icono size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-small ${n.Leido ? 'font-semibold text-text-muted' : 'font-bold text-text'}`}>
                    {n.Titulo}
                  </span>
                  <span className="mt-[0.1rem] block truncate text-[0.72rem] text-text-muted">
                    {META_TIPO[n.Tipo]?.label || n.Tipo} · {fechaCorta(n.FechaCreacion)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* "Ver más" sale SIEMPRE que haya algo, incluso con 5 o menos: el panel
          es una vista previa y el listado tiene filtros, resumen por tipo y el
          botón de marcar el lote, que aquí no caben. El texto cambia para no
          prometer "más" cuando no hay más. */}
      <button
        type="button"
        onClick={irAlListado}
        className="flex min-h-[48px] w-full items-center justify-center gap-xs border-t border-border
                   bg-surface px-lg text-body font-bold text-primary transition-colors
                   hover:bg-primary-wash focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
      >
        {hayMas ? 'Ver más notificaciones' : 'Ver todas las notificaciones'}
        <MdArrowForward size={16} />
      </button>
    </div>,
    document.body,
  );

  return (
    <div className="stock-bell">
      <button
        ref={btnRef}
        className={`stock-bell__btn max-lg:min-h-[44px] max-lg:min-w-[44px] ${noLeidas > 0 ? 'stock-bell__btn--alert' : ''}`}
        onClick={alPulsarCampana}
        title={open ? 'Ir a Notificaciones' : `Notificaciones${noLeidas > 0 ? ` (${noLeidas} sin leer)` : ''}`}
      >
        <MdNotificationsActive size={20} />
        {/* El número es el CONTADOR REAL de no leídas del store. El tope de 99+
            no es un valor fijo: es el límite de lo que cabe en una insignia de
            16px -- por encima de 99 el número desbordaría el círculo. */}
        {noLeidas > 0 && (
          <span className="stock-bell__badge">{noLeidas > 99 ? '99+' : noLeidas}</span>
        )}
      </button>
      {panel}
    </div>
  );
}
