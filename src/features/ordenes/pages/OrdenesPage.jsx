import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { MdVisibility, MdEdit, MdAdd, MdBuild, MdCheck, MdArrowForward, MdDeleteOutline, MdOpenInNew } from 'react-icons/md';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import {
  fetchOrdenes, fetchOrdenById, updateOrden, toggleOrdenEstado,
  addServicioToOrden, addRepuestoToOrden, setManoDeObra, clearSelected,
  deleteServicioFromOrden, deleteRepuestoFromOrden
} from '../slices/ordenesSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import Badge from '../../../shared/components/Badge/Badge.jsx';
import { filterItems, sortNewestFirst, formatDate, formatCurrency } from '../../../shared/utils/helpers.js';
import { generarFacturaOrden } from '../../../shared/utils/generarFacturaPDF.js';
import api from '../../../shared/services/api.js';
import './OrdenesPage.css';

const ESTADO_CONFIG = {
  0: { label: 'Inactivo',   variant: 'gray',    bg: 'rgba(255,255,255,0.08)', color: '#888888', border: 'rgba(255,255,255,0.12)' },
  1: { label: 'Pendiente',  variant: 'warning', bg: 'rgba(245,166,35,0.12)',  color: '#f5a623', border: 'rgba(245,166,35,0.3)'   },
  2: { label: 'En proceso', variant: 'info',    bg: 'rgba(78,154,241,0.12)',  color: '#4e9af1', border: 'rgba(78,154,241,0.3)'   },
  3: { label: 'Realizado',  variant: 'success', bg: 'rgba(181,242,61,0.12)', color: '#b5f23d', border: 'rgba(181,242,61,0.3)'   },
};

const PASOS = [
  { estado: 1, label: 'Pendiente' },
  { estado: 2, label: 'En proceso' },
  { estado: 3, label: 'Realizado' },
];

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] ?? ESTADO_CONFIG[1];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function ProgresoEstado({ estadoActual, onAvanzar, loading, disabled, sinTrabajo }) {
  const estadoNum = estadoActual ?? 0;
  const siguienteEstado = estadoNum < 3 ? estadoNum + 1 : null;
  // No se puede avanzar a Realizado (3) sin al menos un servicio o repuesto.
  const bloqueaRealizado = siguienteEstado === 3 && sinTrabajo;

  return (
    <div className="progreso-container">
      <div className="progreso-steps">
        {PASOS.map((paso, idx) => {
          const completado = estadoNum > paso.estado;
          const actual     = estadoNum === paso.estado;
          return (
            <React.Fragment key={paso.estado}>
              {idx > 0 && (
                <div className={`progreso-line${completado ? ' progreso-line--done' : ''}`} />
              )}
              <div className={`progreso-step${actual ? ' progreso-step--active' : ''}${completado ? ' progreso-step--done' : ''}`}>
                <div className="progreso-dot">
                  {completado ? <MdCheck size={13} /> : <span>{idx + 1}</span>}
                </div>
                <span className="progreso-label">{paso.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="progreso-actions">
        {estadoNum === 0 && (
          <button className="btn btn--primary btn--sm progreso-btn" onClick={() => onAvanzar(1)} disabled={loading || disabled}>
            <MdArrowForward size={15} /> Activar orden
          </button>
        )}
        {siguienteEstado && estadoNum >= 1 && (
          <button
            className="btn btn--primary btn--sm progreso-btn"
            onClick={() => onAvanzar(siguienteEstado)}
            disabled={loading || disabled || bloqueaRealizado}
            title={bloqueaRealizado ? 'Agrega al menos un servicio o repuesto para marcarla como Realizada' : undefined}
          >
            <MdArrowForward size={15} /> Avanzar a: {PASOS.find(p => p.estado === siguienteEstado)?.label}
          </button>
        )}
        {estadoNum === 3 && (
          <p className="progreso-done">✓ Orden completada</p>
        )}
        {estadoNum !== 0 && estadoNum !== 3 && (
          <button className="btn btn--sm progreso-btn--inactivo" onClick={() => onAvanzar(0)} disabled={loading || disabled} title="Marcar como inactiva">
            Poner como Inactivo
          </button>
        )}
      </div>
    </div>
  );
}

// FechaIngreso ya no se edita aquí (se fija una sola vez al generar la orden desde Agenda).
// FechaEntrega solo es editable mientras la orden está Pendiente, y siempre hacia el futuro.
const EMPTY_EDIT = { Diagnostico: '', Kilometraje: '', FechaEntrega: '' };
const ITEMS_PER_PAGE = 5;
const TODAY = new Date().toISOString().split('T')[0];

// Formatea minutos a algo legible: 90 -> "1h 30min", 45 -> "45min", 120 -> "2h".
// null/sin estimar -> "—".
const fmtDuracion = (min) => {
  if (min == null || min === '' || Number.isNaN(Number(min))) return '—';
  const m = Number(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h > 0 && r > 0) return `${h}h ${r}min`;
  if (h > 0) return `${h}h`;
  return `${r}min`;
};

export default function OrdenesPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, selected, loading, actionLoading } = useSelector(s => s.ordenes);
  const puedeEditar  = usePermiso('ORDENES.EDITAR');
  const puedeToggle  = usePermiso('ORDENES.CAMBIAR_ESTADO');
  const [serviciosOpts, setServiciosOpts] = useState([]);
  const [repuestosOpts, setRepuestosOpts] = useState([]);
  const [search, setSearch]               = useState('');
  const [estadoFilter, setEstadoFilter]   = useState('todos');
  const [pageSize, setPageSize]           = useState(5);
  const [detailId, setDetailId]           = useState(null);
  const [activeTab, setActiveTab]         = useState('info');
  const [showEdit, setShowEdit]           = useState(false);
  const [editingId, setEditingId]         = useState(null);
  const [editForm, setEditForm]           = useState(EMPTY_EDIT);
  const [editError, setEditError]         = useState('');
  const [editFechaBloqueada, setEditFechaBloqueada] = useState(false);
  const [addServForm, setAddServForm]     = useState({ Id_Servicio: '', precio_unitario: '' });
  const [addServError, setAddServError]   = useState('');
  const [addRepForm, setAddRepForm]       = useState({ Id_Repuesto: '', cantidad: '', precio_unitario: '' });
  const [addRepError, setAddRepError]     = useState('');
  const [flujoError, setFlujoError]       = useState('');
  const [manoInput, setManoInput]         = useState('');
  const [editingMano, setEditingMano]     = useState(false);
  const [servPage, setServPage]           = useState(0);
  const [repPage, setRepPage]             = useState(0);

  useEffect(() => {
    dispatch(fetchOrdenes());
    api.get('/api/servicios').then(r => setServiciosOpts(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/repuestos').then(r => setRepuestosOpts(r.data?.data || r.data || [])).catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    if (detailId) {
      dispatch(fetchOrdenById(detailId));
      setActiveTab('info');
      setEditingMano(false);
      setManoInput('');
      setServPage(0);
      setRepPage(0);
      setFlujoError('');
    } else {
      dispatch(clearSelected());
    }
  }, [detailId, dispatch]);

  const filtered = (() => {
    let list = items;
    if (estadoFilter !== 'todos') list = list.filter(i => String(i.Estado) === estadoFilter);
    return sortNewestFirst(filterItems(list, search, ['cliente', 'vehiculo', 'Vehiculo', 'Cliente', 'Diagnostico', 'ClienteDoc', 'ClienteCorreo']), 'Id_Orden');
  })();

  // Mini-resumen por estado sobre el total (Estado numérico: 1=Pend, 2=Proc, 3=Real).
  const resumenOrd = useMemo(() => {
    const by = (e) => items.filter(i => i.Estado === e).length;
    return { pendientes: by(1), enProceso: by(2), realizadas: by(3), total: items.length };
  }, [items]);

  // Mapa de repuestos por id para acceder rápido a datos de garantía como fallback
  const repuestoById = useMemo(() =>
    Object.fromEntries(repuestosOpts.map(r => [String(r.Id_Repuesto), r])),
    [repuestosOpts]
  );

  const totalServicios = (selected?.servicios || []).reduce((sum, s) => sum + Number(s.precio_unitario || s.Precio || 0), 0);
  const totalRepuestos = (selected?.repuestos || []).reduce((sum, r) => sum + Number(r.precio_unitario || r.PrecioVenta || 0) * Number(r.cantidad || r.Cantidad || 1), 0);
  const manoDeObra     = selected?.mano_de_obra ?? null;
  const totalGeneral   = totalServicios + totalRepuestos + (manoDeObra || 0);

  // Bloquea SOLO la edición de contenido (servicios, repuestos, mano de obra).
  // El toggle de estado (activar/inactivar) permanece siempre disponible.
  const contenidoBloqueado = selected?.EstadoFlujo === 'Realizado' || selected?.Estado === 0;
  const puedeFacturar  = selected?.EstadoFlujo === 'Realizado';

  const openEdit = (item) => {
    setEditForm({
      Diagnostico:  item.Diagnostico  || '',
      Kilometraje:  item.Kilometraje  || '',
      FechaEntrega: item.FechaEntrega ? item.FechaEntrega.split('T')[0] : '',
    });
    setEditFechaBloqueada(item.EstadoFlujo === 'En proceso');
    setEditingId(item.Id_Orden);
    setEditError('');
    setShowEdit(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.Diagnostico || !editForm.Kilometraje) { setEditError('Diagnóstico y kilometraje son obligatorios.'); return; }
    const km = Number(editForm.Kilometraje);
    if (!Number.isInteger(km) || km < 0) { setEditError('El kilometraje debe ser un entero mayor o igual a 0.'); return; }
    if (!editFechaBloqueada && editForm.FechaEntrega && editForm.FechaEntrega < TODAY) {
      setEditError('La fecha de entrega debe ser hoy o una fecha posterior.'); return;
    }
    // No se envía FechaEntrega si las fechas están bloqueadas (orden En proceso); el
    // backend igual lo rechazaría, pero así evitamos un viaje de red innecesario.
    const { FechaEntrega, ...resto } = editForm;
    const payload = editFechaBloqueada ? resto : editForm;
    // La regla del odómetro (no menor al km del vehículo) la valida el backend en la
    // misma transacción; si el km es menor, devuelve el mensaje que se muestra abajo.
    const result = await dispatch(updateOrden({ id: editingId, data: payload }));
    if (!result.error) { setShowEdit(false); dispatch(fetchOrdenes()); }
    else setEditError(result.payload || 'Error al actualizar.');
  };

  const handleAvanzarEstado = async (newEstado) => {
    if (!detailId) return;
    setFlujoError('');
    const result = await dispatch(toggleOrdenEstado({ id: detailId, Estado: newEstado }));
    if (!result.error) {
      dispatch(fetchOrdenById(detailId));
      dispatch(fetchOrdenes());
    } else {
      // Muestra el mensaje en español de la API (p. ej. Realizada sin trabajo).
      setFlujoError(result.payload || 'No se pudo cambiar el estado de la orden.');
    }
  };

  const handleAddServicio = async (e) => {
    e.preventDefault();
    if (!addServForm.Id_Servicio || !addServForm.precio_unitario) { setAddServError('Selecciona un servicio e ingresa el precio.'); return; }
    const result = await dispatch(addServicioToOrden({ id: detailId, data: addServForm }));
    if (!result.error) { setAddServForm({ Id_Servicio: '', precio_unitario: '' }); setAddServError(''); dispatch(fetchOrdenById(detailId)); }
    else setAddServError(result.payload || 'Error al agregar servicio.');
  };

  // Auto-fill price when selecting a repuesto. Al cliente se le cobra el PRECIO DE VENTA
  // (con IVA y margen), no el costo. Si aún no tiene precio de venta (nunca comprado),
  // cae al costo como respaldo.
  const handleRepuestoSelect = (e) => {
    const id = e.target.value;
    const rep = repuestosOpts.find(r => String(r.Id_Repuesto) === String(id));
    const precio = rep?.PrecioVenta ?? rep?.Precio;
    setAddRepForm(p => ({ ...p, Id_Repuesto: id, precio_unitario: precio != null ? String(precio) : '' }));
  };

  const handleAddRepuesto = async (e) => {
    e.preventDefault();
    if (!addRepForm.Id_Repuesto || !addRepForm.cantidad || !addRepForm.precio_unitario) { setAddRepError('Completa todos los campos.'); return; }
    const result = await dispatch(addRepuestoToOrden({ id: detailId, data: addRepForm }));
    if (!result.error) { setAddRepForm({ Id_Repuesto: '', cantidad: '', precio_unitario: '' }); setAddRepError(''); dispatch(fetchOrdenById(detailId)); }
    else setAddRepError(result.payload || 'Error al agregar repuesto.');
  };

  const handleSetMano = async () => {
    const valor = Number(manoInput);
    if (!manoInput || isNaN(valor) || valor < 0) return;
    const result = await dispatch(setManoDeObra({ id: detailId, valor }));
    if (!result.error) { setEditingMano(false); setManoInput(''); }
  };

  const handleDeleteServicio = async (servicioId) => {
    await dispatch(deleteServicioFromOrden({ id: detailId, servicioId }));
    dispatch(fetchOrdenById(detailId));
  };

  const handleDeleteRepuesto = async (repuestoId) => {
    await dispatch(deleteRepuestoFromOrden({ id: detailId, repuestoId }));
    dispatch(fetchOrdenById(detailId));
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Vehiculo', label: 'Vehículo', render: (v, row) => <span className="font-medium">{v || row.vehiculo || row.Placa || '—'}</span> },
    { key: 'Cliente', label: 'Cliente', render: (v, row) => v || row.cliente || '—' },
    { key: 'Diagnostico', label: 'Diagnóstico', render: v => <span className="diag-cell">{v || '—'}</span> },
    { key: 'FechaIngreso', label: 'Ingreso', render: v => formatDate(v) },
    { key: 'FechaEntrega', label: 'Entrega', render: v => formatDate(v) },
    { key: 'Kilometraje', label: 'Km', render: v => v ? `${Number(v).toLocaleString('es-CO')} km` : '—' },
    { key: 'Estado', label: 'Estado', render: v => <EstadoBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => {
        // Editable = Pendiente/En proceso y con permiso. Realizado/Inactivo -> solo lectura.
        const editable = (row.Estado === 1 || row.Estado === 2) && puedeEditar;
        return (
          <div className="table-actions">
            {editable ? (
              <button className="btn btn--ghost btn--icon btn--sm" title="Editar" onClick={() => setDetailId(row.Id_Orden)}><MdEdit size={17} /></button>
            ) : (
              <button className="btn btn--ghost btn--icon btn--sm" title="Ver" onClick={() => setDetailId(row.Id_Orden)}><MdVisibility size={17} /></button>
            )}
          </div>
        );
      }
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Órdenes de trabajo</h1>
          <p className="page__subtitle">{items.length} orden(es) registrada(s)</p>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por vehículo, cliente, documento, correo..."
            filterSlot={
              <>
                <select className="filter-select" value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}>
                  <option value="todos">Todos los estados</option>
                  <option value="1">Pendiente</option>
                  <option value="2">En proceso</option>
                  <option value="3">Realizado</option>
                  <option value="0">Inactivo</option>
                </select>
                <FilterDropdown
                  statusFilter="todos"
                  onStatusChange={() => {}}
                  pageSize={pageSize}
                  onPageSizeChange={setPageSize}
                />
              </>
            }
          />
        </div>
        {!loading && items.length > 0 && (
          <div className="table-summary">
            <Badge variant="warning">{resumenOrd.pendientes} pendientes</Badge>
            <Badge variant="info">{resumenOrd.enProceso} en proceso</Badge>
            <Badge variant="success">{resumenOrd.realizadas} realizadas</Badge>
            <span className="table-summary__total">{resumenOrd.total} en total</span>
          </div>
        )}
        <Table columns={columns} rowKey="Id_Orden" data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron órdenes de trabajo" />
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!detailId} onClose={() => setDetailId(null)} title="Orden de trabajo" size="xl"
        footer={selected ? (
          <button
            className="btn btn--primary"
            onClick={puedeFacturar ? () => generarFacturaOrden(selected) : undefined}
            disabled={!puedeFacturar}
            title={!puedeFacturar ? 'Solo se puede facturar una orden Realizada' : undefined}
            style={!puedeFacturar ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
          >
            Facturar (PDF)
          </button>
        ) : null}
      >
        {detailId && (
          <div>
            <div className="orden-tabs">
              {['info', 'servicios', 'repuestos'].map(tab => (
                <button key={tab} className={`orden-tab${activeTab === tab ? ' orden-tab--active' : ''}`} onClick={() => setActiveTab(tab)}>
                  {tab === 'info' ? 'Información general' : tab === 'servicios' ? 'Servicios' : 'Repuestos'}
                </button>
              ))}
            </div>

            {activeTab === 'info' && selected && (
              <div className="u-mt-lg">
                <div className="detail-grid">
                  <div className="detail-item"><span className="detail-label">Cliente</span><span className="detail-value">{selected.Cliente || '—'}</span></div>
                  <div className="detail-item"><span className="detail-label">Documento del cliente</span><span className="detail-value">{selected.ClienteDoc || '—'}</span></div>
                  <div className="detail-item"><span className="detail-label">Correo del cliente</span><span className="detail-value">{selected.ClienteCorreo || '—'}</span></div>
                  <div className="detail-item"><span className="detail-label">Empleado asignado</span><span className="detail-value">{selected.Empleado || '—'}</span></div>
                  <div className="detail-item"><span className="detail-label">Vehículo</span><span className="detail-value">{selected.Vehiculo || selected.Placa || '—'}{selected.Marca ? ` · ${selected.Marca}${selected.Modelo ? ` ${selected.Modelo}` : ''}` : ''}</span></div>
                  <div className="detail-item"><span className="detail-label">Fecha de ingreso</span><span className="detail-value">{formatDate(selected.FechaIngreso)}</span></div>
                  <div className="detail-item"><span className="detail-label">Fecha de entrega</span><span className="detail-value">{formatDate(selected.FechaEntrega)}</span></div>
                  <div className="detail-item"><span className="detail-label">Kilometraje</span><span className="detail-value">{selected.Kilometraje ? `${Number(selected.Kilometraje).toLocaleString('es-CO')} km` : '—'}</span></div>
                  <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><EstadoBadge estado={selected.Estado} /></span></div>
                  <div className="detail-item u-span-2"><span className="detail-label">Diagnóstico</span><span className="detail-value">{selected.Diagnostico || '—'}</span></div>
                </div>

                {/* Estado de la orden — siempre visible para poder activar/inactivar
                    o avanzar el flujo, incluso si el contenido está bloqueado. */}
                <div className="u-mt-xl">
                  <p className="detail-label u-mb-md">
                    {selected.Estado === 0 ? 'Estado de la orden' : 'Progreso de la orden'}
                  </p>
                  {selected.Estado === 0 && (
                    <p className="novedad-warning u-mb-md">
                      Esta orden está inactiva. Actívala para poder editar su contenido.
                    </p>
                  )}
                  {flujoError && <div className="form-error-box u-mb-md">{flujoError}</div>}
                  <ProgresoEstado
                    estadoActual={selected.Estado}
                    onAvanzar={handleAvanzarEstado}
                    loading={actionLoading}
                    disabled={!puedeToggle}
                    sinTrabajo={(selected.servicios?.length || 0) === 0 && (selected.repuestos?.length || 0) === 0}
                  />
                </div>

                {/* Editar datos básicos (diagnóstico, km, fechas) — solo si editable */}
                {!contenidoBloqueado && puedeEditar && (
                  <div className="u-mt-xl">
                    <button className="btn btn--outline btn--sm" onClick={() => { openEdit(selected); setDetailId(null); }}>
                      <MdEdit size={15} /> Editar datos (diagnóstico, km, fechas)
                    </button>
                  </div>
                )}

                {/* Garantías de los repuestos usados */}
                {selected?.repuestos?.some(r => {
                  const info = repuestoById[String(r.Id_Repuesto)];
                  return (r.TiempoGarantia ?? info?.TiempoGarantia);
                }) && (
                  <div className="orden-garantias-section">
                    <p className="detail-label">Garantías de repuestos</p>
                    <div className="orden-garantias-list">
                      {selected.repuestos.map((r, i) => {
                        const info = repuestoById[String(r.Id_Repuesto)];
                        const garantia = r.TiempoGarantia ?? info?.TiempoGarantia;
                        const unidad = r.UnidadGarantia ?? info?.UnidadGarantia ?? 'meses';
                        if (!garantia) return null;
                        return (
                          <div key={i} className="orden-garantia-item">
                            <span className="orden-garantia-nombre">{r.repuesto || r.Nombre || `Repuesto #${r.Id_Repuesto}`}</span>
                            <span className="orden-garantia-badge">✓ {garantia} {unidad}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="orden-total-card u-mt-xl">
                  <div className="orden-total-breakdown">
                    <div className="orden-total-row"><span>Servicios</span><span>{formatCurrency(totalServicios)}</span></div>
                    <div className="orden-total-row"><span>Repuestos</span><span>{formatCurrency(totalRepuestos)}</span></div>
                    <div className="orden-total-row"><span>Mano de obra</span><span>{manoDeObra != null ? formatCurrency(manoDeObra) : '—'}</span></div>
                  </div>
                  <div className="orden-total-final">
                    <span>Total</span>
                    <span>{formatCurrency(totalGeneral)}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'servicios' && (
              <div className="u-mt-lg">
                {(() => {
                  const servItems = selected?.servicios || [];
                  const servStart = servPage * ITEMS_PER_PAGE;
                  const servSlice = servItems.slice(servStart, servStart + ITEMS_PER_PAGE);
                  return (
                    <>
                      <div className="orden-items-list">
                        {servItems.length > 0 ? (
                          servSlice.map((s, i) => (
                            <div key={i} className="orden-item-row">
                              <span className="orden-item-name">{s.servicio || s.Nombre || s.nombre || `Servicio #${s.Id_Servicio}`}</span>
                              <span className="orden-item-duracion u-muted-nowrap" title="Duración estimada">{fmtDuracion(s.DuracionMinutos)}</span>
                              <span className="orden-item-price">{formatCurrency(s.precio_unitario || s.Precio)}</span>
                              {!contenidoBloqueado && (
                                <button className="btn btn--ghost btn--icon btn--sm orden-item-delete" title="Eliminar servicio" onClick={() => handleDeleteServicio(s.Id_Servicio)} disabled={actionLoading}>
                                  <MdDeleteOutline size={16} />
                                </button>
                              )}
                            </div>
                          ))
                        ) : <p className="empty-list">No hay servicios agregados.</p>}
                      </div>
                      {servItems.length > 0 && (
                        <div className="orden-item-row u-semibold">
                          <span className="orden-item-name">Tiempo total estimado</span>
                          <span className="orden-item-duracion u-nowrap">{fmtDuracion(selected?.DuracionTotalMin)}</span>
                          <span className="orden-item-price" />
                        </div>
                      )}
                      {servItems.length > ITEMS_PER_PAGE && (
                        <div className="pagination-controls">
                          <button className="btn btn--outline btn--sm" onClick={() => setServPage(p => p - 1)} disabled={servPage === 0}>Anterior</button>
                          <span className="pagination-info">Mostrando {servStart + 1}–{Math.min(servStart + ITEMS_PER_PAGE, servItems.length)} de {servItems.length}</span>
                          <button className="btn btn--outline btn--sm" onClick={() => setServPage(p => p + 1)} disabled={servStart + ITEMS_PER_PAGE >= servItems.length}>Siguiente</button>
                        </div>
                      )}
                    </>
                  );
                })()}

                <div className="mano-de-obra-section">
                  <div className="mano-de-obra-header">
                    <MdBuild size={16} className="mano-de-obra-icon" />
                    <span className="mano-de-obra-title">Mano de obra</span>
                  </div>
                  {manoDeObra != null && !editingMano ? (
                    <div className="mano-de-obra-row">
                      <span className="mano-de-obra-value">{formatCurrency(manoDeObra)}</span>
                      {!contenidoBloqueado && (
                        <button className="btn btn--outline btn--sm" onClick={() => { setManoInput(String(manoDeObra)); setEditingMano(true); }}>
                          <MdEdit size={15} /> Editar
                        </button>
                      )}
                    </div>
                  ) : !contenidoBloqueado ? (
                    <div className="mano-de-obra-form">
                      <input type="number" min="0" className="form-control" placeholder="Valor mano de obra..." value={manoInput} onChange={e => setManoInput(e.target.value)} />
                      <button className="btn btn--primary btn--sm" onClick={handleSetMano} disabled={actionLoading || !manoInput}>
                        {actionLoading ? 'Guardando...' : 'Guardar'}
                      </button>
                      {editingMano && <button className="btn btn--outline btn--sm" onClick={() => { setEditingMano(false); setManoInput(''); }}>Cancelar</button>}
                    </div>
                  ) : null}
                </div>

                <div className="orden-subtotal">
                  <span>Subtotal servicios + mano de obra</span>
                  <span>{formatCurrency(totalServicios + (manoDeObra || 0))}</span>
                </div>

                {!contenidoBloqueado && (
                  <div className="orden-add-form">
                    <div className="orden-add-form__head">
                      <h4>Agregar servicio</h4>
                      <button type="button" className="btn btn--outline btn--sm" onClick={() => navigate('/servicios')} title="Crear o gestionar servicios en su propia página">
                        <MdOpenInNew size={14} /> Ir a Servicios
                      </button>
                    </div>
                    {addServError && <div className="form-error-box u-mb-sm">{addServError}</div>}
                    <div className="orden-add-row">
                      <select className="form-control" value={addServForm.Id_Servicio}
                        onChange={e => {
                          const id = e.target.value;
                          const serv = serviciosOpts.find(s => String(s.Id_Servicio) === String(id));
                          setAddServForm(p => ({ ...p, Id_Servicio: id, precio_unitario: serv ? String(serv.Precio ?? '') : p.precio_unitario }));
                        }}>
                        <option value="">Seleccionar servicio...</option>
                        {serviciosOpts.map(s => <option key={s.Id_Servicio} value={s.Id_Servicio}>{s.Nombre}</option>)}
                      </select>
                      <input type="number" min="0" className="form-control" placeholder="Precio unitario" value={addServForm.precio_unitario} onChange={e => setAddServForm(p => ({ ...p, precio_unitario: e.target.value }))} />
                      {addServForm.precio_unitario && <span className="u-muted-nowrap">= {formatCurrency(addServForm.precio_unitario)}</span>}
                      <button className="btn btn--primary btn--sm" onClick={handleAddServicio} disabled={actionLoading}><MdAdd size={16} />Agregar</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'repuestos' && (
              <div className="u-mt-lg">
                {(() => {
                  const repItems = selected?.repuestos || [];
                  const repStart = repPage * ITEMS_PER_PAGE;
                  const repSlice = repItems.slice(repStart, repStart + ITEMS_PER_PAGE);
                  return (
                    <>
                      <div className="orden-items-list">
                        {repItems.length > 0 ? (
                          repSlice.map((r, i) => {
                            const info = repuestoById[String(r.Id_Repuesto)];
                            const garantia = r.TiempoGarantia ?? info?.TiempoGarantia;
                            const unidad = r.UnidadGarantia ?? info?.UnidadGarantia ?? 'meses';
                            return (
                              <div key={i} className="orden-item-row">
                                <div className="orden-item-name-group">
                                  <span className="orden-item-name">{r.repuesto || r.Nombre || r.nombre || `Repuesto #${r.Id_Repuesto}`}</span>
                                  {garantia && (
                                    <span className="orden-item-garantia">· Garantía: {garantia} {unidad}</span>
                                  )}
                                </div>
                                <span className="orden-item-qty">x{r.cantidad || r.Cantidad}</span>
                                <span className="orden-item-price">{formatCurrency((r.precio_unitario || r.PrecioVenta || 0) * (r.cantidad || r.Cantidad || 1))}</span>
                                {!contenidoBloqueado && (
                                  <button className="btn btn--ghost btn--icon btn--sm orden-item-delete" title="Eliminar repuesto" onClick={() => handleDeleteRepuesto(r.Id_Repuesto)} disabled={actionLoading}>
                                    <MdDeleteOutline size={16} />
                                  </button>
                                )}
                              </div>
                            );
                          })
                        ) : <p className="empty-list">No hay repuestos agregados.</p>}
                      </div>
                      {repItems.length > ITEMS_PER_PAGE && (
                        <div className="pagination-controls">
                          <button className="btn btn--outline btn--sm" onClick={() => setRepPage(p => p - 1)} disabled={repPage === 0}>Anterior</button>
                          <span className="pagination-info">Mostrando {repStart + 1}–{Math.min(repStart + ITEMS_PER_PAGE, repItems.length)} de {repItems.length}</span>
                          <button className="btn btn--outline btn--sm" onClick={() => setRepPage(p => p + 1)} disabled={repStart + ITEMS_PER_PAGE >= repItems.length}>Siguiente</button>
                        </div>
                      )}
                    </>
                  );
                })()}

                <div className="orden-subtotal">
                  <span>Total repuestos</span>
                  <span>{formatCurrency(totalRepuestos)}</span>
                </div>

                {!contenidoBloqueado && (
                  <div className="orden-add-form">
                    <div className="orden-add-form__head">
                      <h4>Agregar repuesto</h4>
                      <button type="button" className="btn btn--outline btn--sm" onClick={() => navigate('/repuestos')} title="Crear o gestionar repuestos en su propia página">
                        <MdOpenInNew size={14} /> Ir a Repuestos
                      </button>
                    </div>
                    {addRepError && <div className="form-error-box u-mb-sm">{addRepError}</div>}
                    <div className="orden-add-row">
                      <select className="form-control" value={addRepForm.Id_Repuesto} onChange={handleRepuestoSelect}>
                        <option value="">Seleccionar repuesto...</option>
                        {repuestosOpts.map(r => <option key={r.Id_Repuesto} value={r.Id_Repuesto}>{r.NombreRepuesto ?? r.Nombre}</option>)}
                      </select>
                      <input type="number" min="1" className="form-control" placeholder="Cantidad" value={addRepForm.cantidad} onChange={e => setAddRepForm(p => ({ ...p, cantidad: e.target.value }))} />
                      <input
                        type="number" min="0" className="form-control"
                        placeholder="Precio unitario"
                        value={addRepForm.precio_unitario}
                        onChange={e => setAddRepForm(p => ({ ...p, precio_unitario: e.target.value }))}
                        title="Precio por defecto del repuesto, editable para esta orden"
                      />
                      <button className="btn btn--primary btn--sm" onClick={handleAddRepuesto} disabled={actionLoading}><MdAdd size={16} />Agregar</button>
                    </div>
                    {addRepForm.Id_Repuesto && addRepForm.precio_unitario && (
                      <p className="u-hint u-mt-xs">
                        Precio por defecto: {formatCurrency(addRepForm.precio_unitario)} — puedes modificarlo para esta orden.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Editar orden de trabajo" size="md"
        footer={<><button className="btn btn--outline" onClick={() => setShowEdit(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleEditSubmit} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {editError && <div className="form-error-box">{editError}</div>}
        <form className="form-grid" onSubmit={handleEditSubmit} noValidate>
          <div className="form-group span-2">
            <label className="form-label">Fecha de entrega</label>
            <input name="FechaEntrega" type="date" className="form-control" value={editForm.FechaEntrega}
              onChange={e => setEditForm(p => ({ ...p, FechaEntrega: e.target.value }))}
              min={TODAY} disabled={editFechaBloqueada} />
            {editFechaBloqueada
              ? <p className="form-hint">La orden está en proceso: la fecha de entrega no se puede modificar hasta que finalice o vuelva a Pendiente.</p>
              : <p className="form-hint">Solo se puede fijar hacia una fecha futura. La fecha de ingreso queda fija desde que se generó la orden.</p>}
          </div>
          <div className="form-group"><label className="form-label">Kilometraje <span className="required">*</span></label><input name="Kilometraje" type="number" min="0" className="form-control" value={editForm.Kilometraje} onChange={e => setEditForm(p => ({ ...p, Kilometraje: e.target.value }))} /></div>
          <div className="form-group span-2"><label className="form-label">Diagnóstico <span className="required">*</span></label><textarea name="Diagnostico" className="form-control" value={editForm.Diagnostico} onChange={e => setEditForm(p => ({ ...p, Diagnostico: e.target.value }))} rows={4} maxLength={500} /></div>
        </form>
      </Modal>
    </div>
  );
}

