import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  MdNotificationsActive, MdEventNote, MdInventory2,
  MdLocalShipping, MdReceiptLong, MdArrowForward,
} from 'react-icons/md';
import { fetchNotificaciones, marcarNotificacionLeida, PAGE_SIZE } from '../../../features/notificaciones/slices/notificacionesSlice.js';
import {
  META_TIPO, estiloTipo,
  NOTIF_PANEL, NOTIF_PANEL_CABECERA, NOTIF_PANEL_LISTA, NOTIF_PANEL_FILA,
  NOTIF_PANEL_PIE, NOTIF_PANEL_VACIO,
} from '../../styles/clasesNotificaciones.js';
/* Se reusa el CSS de StockAlertBell SOLO para el BOTÓN y la insignia: las tres
   campanas viven en la misma barra oscura y tienen que verse idénticas.

   El PANEL ya NO usa .stock-bell__dropdown. Esa clase declara `overflow: hidden`
   sin altura máxima, así que en cuanto el contenido no cabía en la pantalla se
   recortaba sin forma de desplazarlo. El panel tiene ahora su propia geometría
   en clasesNotificaciones.js, con altura acotada y la lista desplazándose
   dentro. */
import '../StockAlertBell/StockAlertBell.css';

const ICONO_TIPO = {
  CITAS: MdEventNote,
  STOCK_BAJO: MdInventory2,
  LOGISTICA: MdLocalShipping,
  FACTURACION: MdReceiptLong,
};

/* MÁXIMO en el panel flotante. Son las CINCO PRIMERAS de la misma lista que
   pinta /notificaciones -- mismo orden, mismo origen, mismo store -- porque el
   panel es el acceso rapido a esa vista, no otra lista. El resto se ve alli. */
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

  /* El MISMO tamano que usa la pagina: las dos vistas comparten `items`, asi
     que pedir tamanos distintos hacia que la ultima en cargar decidiera cuantas
     ve la otra. */
  useEffect(() => { dispatch(fetchNotificaciones({ pageSize: PAGE_SIZE })); }, [dispatch]);

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
      className={NOTIF_PANEL}
      ref={panelRef}
      style={{ top: pos.top, left: pos.left, width: 'min(320px, calc(100vw - 16px))' }}
    >
      <div className={NOTIF_PANEL_CABECERA}>
        <MdNotificationsActive size={16} />
        <span>Notificaciones{noLeidas > 0 ? ` (${noLeidas} sin leer)` : ''}</span>
      </div>

      {/* La LISTA es la unica franja que se desplaza; cabecera y pie quedan
          fijos para que el boton de "ver mas" no se vaya nunca de la pantalla. */}
      <div className={NOTIF_PANEL_LISTA}>
        {previo.length === 0 ? (
          <div className={NOTIF_PANEL_VACIO}>Sin notificaciones</div>
        ) : previo.map(n => {
          const Icono = ICONO_TIPO[n.Tipo] || MdNotificationsActive;
          return (
            <button
              key={n.Id}
              type="button"
              onClick={() => abrirNotificacion(n)}
              className={`${NOTIF_PANEL_FILA} ${n.Leido ? '' : 'bg-primary-wash'}`}
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

      {/* Solo cuando hay MAS de 5: con 5 o menos, el panel ya muestra todo lo
          que hay y un "ver mas" prometeria algo que no existe. Para ir al
          listado sin que sobre nada estan el segundo clic en la campana y la
          entrada "Notificaciones" del menu. */}
      {hayMas && (
        <button type="button" onClick={irAlListado} className={NOTIF_PANEL_PIE}>
          Ver más notificaciones
          <MdArrowForward size={16} />
        </button>
      )}
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
