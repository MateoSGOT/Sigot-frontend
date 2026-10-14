import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  MdNotificationsActive, MdEventNote, MdInventory2, MdLocalShipping,
  MdReceiptLong, MdDoneAll, MdNotificationsNone,
} from 'react-icons/md';
import {
  fetchNotificaciones, marcarNotificacionLeida, marcarTodasLeidas,
} from '../slices/notificacionesSlice.js';
import { useToast } from '../../../shared/components/Toast/ToastContext.jsx';
import Paginacion from '../../../shared/components/Paginacion/Paginacion.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
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
  const { items, total, noLeidas, porTipo, loading, actionLoading } = useSelector(s => s.notificaciones);
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [tipoFiltro, setTipoFiltro] = useState('TODOS');
  /* Paginacion en SERVIDOR, el mismo patron que servicios/repuestos/compras:
     la pagina y el tamano son estado local y el backend devuelve { data, total }.
     Con 181 alertas de stock bajo -- y creciendo -- traerlas todas para cortar
     en el cliente es justo lo que colapsa la vista. */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* Repuesto a resaltar al llegar desde la campana de stock. Viene por el state
     del router porque es un detalle de navegacion, no un recurso con URL. */
  const location = useLocation();
  const resaltarRepuesto = location.state?.resaltarRepuesto ?? null;
  const filaResaltada = useRef(null);

  /* Se carga UNA vez la lista sin filtrar y los dos filtros -- tipo y "sin
     leer" -- se aplican en el cliente.

     Antes "sin leer" se mandaba al servidor, y eso rompia la campana: la
     recarga reemplazaba `items` en el store, que es la MISMA lista que lee el
     panel del Sidebar, asi que activar el filtro aqui dejaba a la campana
     mostrando solo las no leidas sin que nadie se lo hubiera pedido. El panel
     es el acceso rapido a esta vista: tiene que ver lo mismo que ella.

     El contador `noLeidas` sigue viniendo del servidor, que es quien conoce el
     total real mas alla de la pagina cargada. */
  const cargar = useCallback(async () => {
    // 'all' en el selector equivale a pedir todo de una, igual que en los demas
    // modulos (ver ServiciosPage: pageSize === 'all' -> 9999).
    const ps = pageSize === 'all' ? 9999 : pageSize;
    /* Los filtros viajan al SERVIDOR junto con el paginado. Aplicarlos en el
       cliente solo miraba la pagina cargada: pedir "Citas" en la pagina 1 de 20
       mostraba unicamente las que cayeran en esas 10 filas, y vacio si no caia
       ninguna aunque existieran mas adelante. */
    const r = await dispatch(fetchNotificaciones({
      page, pageSize: ps, soloNoLeidas,
      tipo: tipoFiltro === 'TODOS' ? null : tipoFiltro,
    }));
    if (r.error) addToast({ type: 'error', message: 'No se pudieron cargar las notificaciones.' });
  }, [dispatch, page, pageSize, soloNoLeidas, tipoFiltro, addToast]);

  useEffect(() => { cargar(); }, [cargar]);

  /* Se desplaza hasta la alerta del repuesto pulsado en cuanto la lista esta
     en pantalla. Depende de `items` y no solo del state: al llegar desde la
     campana la lista aun no ha cargado, y hacer el scroll antes no encontraria
     la fila. `block: center` y no `start` porque la lista tiene su propio
     scroll dentro del modulo: alinear arriba la dejaria pegada al borde. */
  useEffect(() => {
    if (!resaltarRepuesto || !filaResaltada.current) return;
    filaResaltada.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [resaltarRepuesto, items]);

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

  /* Cambiar un filtro vuelve a la primera pagina. Sin esto, estando en la
     pagina 7 y filtrando por "Citas" se quedaria en una pagina que ya no existe
     y la lista saldria vacia sin explicacion. */
  const cambiarTipo = (t) => { setTipoFiltro(t); setPage(1); };
  const cambiarNoLeidas = (v) => { setSoloNoLeidas(v); setPage(1); };
  const cambiarPageSize = (v) => { setPageSize(v); setPage(1); };

  const totalPaginas = pageSize === 'all'
    ? 1
    : Math.max(1, Math.ceil(total / Number(pageSize)));

  // Ya viene filtrado y paginado del servidor: aqui solo se pinta.
  const visibles = items;

  /* Del SERVIDOR y sobre todo el alcance del rol, no sobre la pagina: con 181
     alertas repartidas en 20 paginas, contar lo cargado hacia que la pastilla
     dijera "Stock bajo (8)". Ahora el numero y lo que muestra el filtro
     coinciden porque los dos los decide la misma consulta. */
  const conteoPorTipo = porTipo || {};

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Notificaciones</h1>
          <p className="page__subtitle">
            {loading
              ? 'Cargando...'
              : `${total} alerta(s) · ${noLeidas} sin leer${totalPaginas > 1 ? ` · página ${page} de ${totalPaginas}` : ''}`}
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
                  onClick={() => cambiarNoLeidas(false)}
                >
                  Todas
                </button>
                <button
                  className={`${NOTIF_FILTRO}${soloNoLeidas ? ` ${NOTIF_FILTRO_ACTIVO}` : ''}`}
                  onClick={() => cambiarNoLeidas(true)}
                >
                  Sin leer {noLeidas > 0 ? `(${noLeidas})` : ''}
                </button>
                <span className="mx-xs h-[24px] w-px bg-border" aria-hidden="true" />
                <button
                  className={`${NOTIF_FILTRO}${tipoFiltro === 'TODOS' ? ` ${NOTIF_FILTRO_ACTIVO}` : ''}`}
                  onClick={() => cambiarTipo('TODOS')}
                >
                  Todo tipo
                </button>
                {TIPOS_NOTIFICACION.map(t => (
                  <button
                    key={t.tipo}
                    className={`${NOTIF_FILTRO}${tipoFiltro === t.tipo ? ` ${NOTIF_FILTRO_ACTIVO}` : ''}`}
                    onClick={() => cambiarTipo(t.tipo)}
                  >
                    {t.label} {conteoPorTipo[t.tipo] ? `(${conteoPorTipo[t.tipo]})` : ''}
                  </button>
                ))}
                {/* Mismo selector de tamano que el resto de modulos, para que
                    "10 / 25 / 50 / todas" signifique lo mismo en toda la app. */}
                <span className="ml-auto">
                  <FilterDropdown
                    pageSize={pageSize}
                    onPageSizeChange={cambiarPageSize}
                    /* Sin el filtro de estado: las notificaciones no tienen
                       activo/inactivo, y sus propios filtros ya estan a la
                       izquierda en pastillas. */
                    showStatus={false}
                  />
                </span>
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
                  /* La alerta del repuesto que se pulso en la campana: se marca
                     con un anillo, que es lo que responde "cual era el que
                     seleccione". El anillo no sustituye a la franja de no
                     leida -- son dos cosas distintas y pueden coincidir. */
                  const esResaltada = resaltarRepuesto != null
                    && n.Tipo === 'STOCK_BAJO' && Number(n.EntidadId) === Number(resaltarRepuesto);
                  return (
                    <button
                      key={n.Id}
                      ref={esResaltada ? filaResaltada : undefined}
                      type="button"
                      onClick={() => marcarUna(n)}
                      className={`${NOTIF_FILA} ${n.Leido ? NOTIF_FILA_LEIDA : NOTIF_FILA_NO_LEIDA}${esResaltada ? ' ring-2 ring-inset ring-primary' : ''}`}
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
            {/* El MISMO control que usan las tablas de los demas modulos
                (shared/components/Paginacion), no una copia: ver el encabezado
                de ese fichero. */}
            <Paginacion page={page} totalPages={totalPaginas} onPageChange={setPage} />
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
