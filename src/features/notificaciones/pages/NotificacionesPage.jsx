import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  MdNotificationsActive, MdEventNote, MdInventory2, MdLocalShipping,
  MdReceiptLong, MdDoneAll, MdNotificationsNone,
} from 'react-icons/md';
import {
  fetchNotificaciones, marcarNotificacionLeida, marcarTodasLeidas, PAGE_SIZE,
} from '../slices/notificacionesSlice.js';
import { useToast } from '../../../shared/components/Toast/ToastContext.jsx';
import {
  TIPOS_NOTIFICACION, META_TIPO, estiloTipo, NOTIF_ICONO, NOTIF_LISTA, NOTIF_FILA,
  NOTIF_FILA_NO_LEIDA, NOTIF_FILA_LEIDA, NOTIF_TITULO, NOTIF_TITULO_LEIDO,
  NOTIF_MENSAJE, NOTIF_FECHA, NOTIF_PILDORA, NOTIF_VACIO,
  NOTIF_FILTROS, NOTIF_FILTRO, NOTIF_FILTRO_ACTIVO,
} from '../../../shared/styles/clasesNotificaciones.js';

/* Un icono por tipo. El mapa está aquí y no en clasesNotificaciones.js a
   propósito: ese módulo lo importa también RolesPage, y arrastrar react-icons a
   un fichero de estilos acopla las dos pantallas a la librería de iconos sin
   necesidad. */
const ICONO_TIPO = {
  CITAS: MdEventNote,
  STOCK_BAJO: MdInventory2,
  LOGISTICA: MdLocalShipping,
  FACTURACION: MdReceiptLong,
};

/* Fecha relativa. Con alta densidad, "hace 5 min" se lee de un golpe y una
   fecha absoluta obliga a calcular; a partir de un día ya importa el día
   concreto, así que se cambia a fecha corta. */
const fechaRelativa = (iso) => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} día${d > 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function NotificacionesPage() {
  const { addToast } = useToast();
  const dispatch = useDispatch();
  /* Del STORE y no de estado local: la campana del Sidebar lee el mismo
     contador, asi que marcar algo como leido aqui lo baja alli sin recargar.
     Con estado local, los dos pedian lo mismo por su cuenta y quedaban
     desincronizados en cuanto el usuario tocaba uno. */
  const { items, total, noLeidas, loading, actionLoading } = useSelector(s => s.notificaciones);
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [tipoFiltro, setTipoFiltro] = useState('TODOS');

  /* Se carga UNA vez la lista sin filtrar y los dos filtros -- tipo y "sin
     leer" -- se aplican en el cliente.

     Antes "sin leer" se mandaba al servidor, y eso rompia la campana: la
     recarga reemplazaba `items` en el store, que es la MISMA lista que lee el
     panel del Sidebar, asi que activar el filtro aqui dejaba a la campana
     mostrando solo las no leidas sin que nadie se lo hubiera pedido. El panel
     es el acceso rapido a esta vista: tiene que ver lo mismo que ella.

     El contador `noLeidas` sigue viniendo del servidor, que es quien conoce el
     total real mas alla de las PAGE_SIZE traidas. */
  const cargar = useCallback(async () => {
    const r = await dispatch(fetchNotificaciones({ page: 1, pageSize: PAGE_SIZE }));
    if (r.error) addToast({ type: 'error', message: 'No se pudieron cargar las notificaciones.' });
  }, [dispatch, addToast]);

  useEffect(() => { cargar(); }, [cargar]);

  /* El optimismo vive en el SLICE (se aplica en `pending` y se revierte en
     `rejected`), no aqui: asi la campana del Sidebar tambien ve el cambio al
     instante, y si falla se revierte solo esa fila en vez de recargar la lista
     entera, que perderia el scroll del usuario. */
  const marcarUna = async (n) => {
    if (n.Leido) return;
    const r = await dispatch(marcarNotificacionLeida(n.Id));
    if (r.error) addToast({ type: 'error', message: 'No se pudo marcar como leída.' });
  };

  const marcarTodas = async () => {
    const r = await dispatch(marcarTodasLeidas());
    if (r.error) {
      addToast({ type: 'error', message: 'No se pudo marcar el lote como leído.' });
      return;
    }
    // El numero lo decide el SERVIDOR (solo el lote que este rol ve), no se
    // adivina aqui: adelantarlo podria decir "12" cuando cambiaron 8.
    const n = r.payload ?? 0;
    addToast({
      type: n > 0 ? 'success' : 'info',
      message: n > 0 ? `${n} notificación(es) marcadas como leídas.` : 'No había notificaciones sin leer.',
    });
  };

  const visibles = items
    .filter(n => (tipoFiltro === 'TODOS' ? true : n.Tipo === tipoFiltro))
    .filter(n => (soloNoLeidas ? !n.Leido : true));

  /* Conteo por tipo sobre lo CARGADO, que es lo mismo que filtra la pastilla:
     si el número viniera del total del servidor y el filtro del cliente, la
     pastilla diría "12" y mostraría 8. */
  const conteoPorTipo = items.reduce((acc, n) => { acc[n.Tipo] = (acc[n.Tipo] || 0) + 1; return acc; }, {});

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Notificaciones</h1>
          <p className="page__subtitle">
            {loading ? 'Cargando...' : `${total} alerta(s) · ${noLeidas} sin leer`}
          </p>
        </div>
        <button
          className="btn btn--primary"
          onClick={marcarTodas}
          disabled={actionLoading || noLeidas === 0}
          title={noLeidas === 0 ? 'No hay notificaciones sin leer' : 'Marca como leídas todas las que te corresponden'}
        >
          <MdDoneAll size={18} />
          {actionLoading ? 'Marcando...' : 'Marcar todas como leídas'}
        </button>
      </div>

      <div className="bento">
        {/* El listado ocupa 8 de 12 y el resumen 4: el reparto desigual es lo
            que hace que esto sea un bento y no dos cajas iguales. */}
        <section className="bento__module bento__module--8">
          <div className="card">
            <div className="card__header">
              <div className={NOTIF_FILTROS}>
                <button
                  className={`${NOTIF_FILTRO}${!soloNoLeidas ? ` ${NOTIF_FILTRO_ACTIVO}` : ''}`}
                  onClick={() => setSoloNoLeidas(false)}
                >
                  Todas
                </button>
                <button
                  className={`${NOTIF_FILTRO}${soloNoLeidas ? ` ${NOTIF_FILTRO_ACTIVO}` : ''}`}
                  onClick={() => setSoloNoLeidas(true)}
                >
                  Sin leer {noLeidas > 0 ? `(${noLeidas})` : ''}
                </button>
                <span className="mx-xs h-[24px] w-px bg-border" aria-hidden="true" />
                <button
                  className={`${NOTIF_FILTRO}${tipoFiltro === 'TODOS' ? ` ${NOTIF_FILTRO_ACTIVO}` : ''}`}
                  onClick={() => setTipoFiltro('TODOS')}
                >
                  Todo tipo
                </button>
                {TIPOS_NOTIFICACION.map(t => (
                  <button
                    key={t.tipo}
                    className={`${NOTIF_FILTRO}${tipoFiltro === t.tipo ? ` ${NOTIF_FILTRO_ACTIVO}` : ''}`}
                    onClick={() => setTipoFiltro(t.tipo)}
                  >
                    {t.label} {conteoPorTipo[t.tipo] ? `(${conteoPorTipo[t.tipo]})` : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className={NOTIF_LISTA}>
              {loading ? (
                <div className={NOTIF_VACIO}>
                  <MdNotificationsActive size={28} className="text-text-muted" />
                  <p className="text-body text-text-muted">Cargando notificaciones...</p>
                </div>
              ) : visibles.length === 0 ? (
                <div className={NOTIF_VACIO}>
                  <MdNotificationsNone size={32} className="text-text-muted" />
                  <p className="text-body font-bold text-text">Sin notificaciones</p>
                  <p className="text-small text-text-muted">
                    {soloNoLeidas || tipoFiltro !== 'TODOS'
                      ? 'Ninguna alerta coincide con este filtro.'
                      : 'Tu rol no tiene alertas pendientes. Las suscripciones se configuran en Roles.'}
                  </p>
                </div>
              ) : (
                visibles.map(n => {
                  const Icono = ICONO_TIPO[n.Tipo] || MdNotificationsActive;
                  const meta = META_TIPO[n.Tipo];
                  return (
                    <button
                      key={n.Id}
                      type="button"
                      onClick={() => marcarUna(n)}
                      className={`${NOTIF_FILA} ${n.Leido ? NOTIF_FILA_LEIDA : NOTIF_FILA_NO_LEIDA}`}
                      title={n.Leido ? 'Ya leída' : 'Marcar como leída'}
                    >
                      <span className={NOTIF_ICONO} style={estiloTipo(n.Tipo)}>
                        <Icono size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-sm">
                          <span className={n.Leido ? NOTIF_TITULO_LEIDO : NOTIF_TITULO}>{n.Titulo}</span>
                          <span className={NOTIF_PILDORA} style={estiloTipo(n.Tipo)}>
                            {meta?.label || n.Tipo}
                          </span>
                        </span>
                        <span className={`block ${NOTIF_MENSAJE}`}>{n.Mensaje}</span>
                        <span className={`block ${NOTIF_FECHA}`}>{fechaRelativa(n.FechaCreacion)}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <aside className="bento__module bento__module--4">
          <div className="card">
            <div className="card__header">
              <h3 className="text-body font-bold text-text">Resumen por tipo</h3>
            </div>
            <div className="flex flex-col gap-md px-lg py-lg">
              {TIPOS_NOTIFICACION.map(t => (
                <div key={t.tipo} className="flex items-center gap-md">
                  <span className={NOTIF_ICONO} style={estiloTipo(t.tipo)}>
                    {React.createElement(ICONO_TIPO[t.tipo] || MdNotificationsActive, { size: 20 })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-bold text-text">{t.label}</span>
                    <span className="block text-small text-text-muted">{t.descripcion}</span>
                  </span>
                  <span className="text-h3 font-extrabold tabular-nums text-text">{conteoPorTipo[t.tipo] || 0}</span>
                </div>
              ))}
              <p className="mt-sm text-small leading-snug text-text-muted">
                Solo ves los tipos a los que tu rol está suscrito. Un administrador
                los configura en <strong className="text-text">Roles</strong>.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
