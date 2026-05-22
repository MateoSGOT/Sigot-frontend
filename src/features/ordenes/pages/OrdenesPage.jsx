import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdVisibility, MdEdit, MdAdd, MdBuild, MdCheck, MdArrowForward } from 'react-icons/md';
import {
  fetchOrdenes, fetchOrdenById, updateOrden, toggleOrdenEstado,
  addServicioToOrden, addRepuestoToOrden, setManoDeObra, clearSelected
} from '../slices/ordenesSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import Badge from '../../../shared/components/Badge/Badge.jsx';
import { filterItems, formatDate, formatCurrency } from '../../../shared/utils/helpers.js';
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

function ProgresoEstado({ estadoActual, onAvanzar, loading }) {
  const estadoNum = estadoActual ?? 0;
  const siguienteEstado = estadoNum < 3 ? estadoNum + 1 : null;

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
          <button className="btn btn--primary btn--sm progreso-btn" onClick={() => onAvanzar(1)} disabled={loading}>
            <MdArrowForward size={15} /> Activar orden
          </button>
        )}
        {siguienteEstado && estadoNum >= 1 && (
          <button className="btn btn--primary btn--sm progreso-btn" onClick={() => onAvanzar(siguienteEstado)} disabled={loading}>
            <MdArrowForward size={15} /> Avanzar a: {PASOS.find(p => p.estado === siguienteEstado)?.label}
          </button>
        )}
        {estadoNum === 3 && (
          <p className="progreso-done">✓ Orden completada</p>
        )}
        {estadoNum !== 0 && (
          <button className="btn btn--sm progreso-btn--inactivo" onClick={() => onAvanzar(0)} disabled={loading} title="Marcar como inactiva">
            Poner como Inactivo
          </button>
        )}
      </div>
    </div>
  );
}

const EMPTY_EDIT = { Diagnostico: '', Kilometraje: '', FechaIngreso: '', FechaEntrega: '' };

export default function OrdenesPage() {
  const dispatch = useDispatch();
  const { items, selected, loading, actionLoading } = useSelector(s => s.ordenes);
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
  const [addServForm, setAddServForm]     = useState({ Id_Servicio: '', precio_unitario: '' });
  const [addServError, setAddServError]   = useState('');
  const [addRepForm, setAddRepForm]       = useState({ Id_Repuesto: '', cantidad: '', precio_unitario: '' });
  const [addRepError, setAddRepError]     = useState('');
  const [manoInput, setManoInput]         = useState('');
  const [editingMano, setEditingMano]     = useState(false);

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
    } else {
      dispatch(clearSelected());
    }
  }, [detailId, dispatch]);

  const filtered = (() => {
    let list = items;
    if (estadoFilter !== 'todos') list = list.filter(i => String(i.Estado) === estadoFilter);
    return filterItems(list, search, ['cliente', 'vehiculo', 'Vehiculo', 'Cliente', 'Diagnostico']);
  })();

  // Mapa de repuestos por id para acceder rápido a datos de garantía como fallback
  const repuestoById = useMemo(() =>
    Object.fromEntries(repuestosOpts.map(r => [String(r.Id_Repuesto), r])),
    [repuestosOpts]
  );

  const totalServicios = (selected?.servicios || []).reduce((sum, s) => sum + Number(s.precio_unitario || s.Precio || 0), 0);
  const totalRepuestos = (selected?.repuestos || []).reduce((sum, r) => sum + Number(r.precio_unitario || r.PrecioVenta || 0) * Number(r.cantidad || r.Cantidad || 1), 0);
  const manoDeObra     = selected?.mano_de_obra ?? null;
  const totalGeneral   = totalServicios + totalRepuestos + (manoDeObra || 0);

  const openEdit = (item) => {
    setEditForm({
      Diagnostico:  item.Diagnostico  || '',
      Kilometraje:  item.Kilometraje  || '',
      FechaIngreso: item.FechaIngreso ? item.FechaIngreso.split('T')[0] : '',
      FechaEntrega: item.FechaEntrega ? item.FechaEntrega.split('T')[0] : '',
    });
    setEditingId(item.Id_Orden);
    setEditError('');
    setShowEdit(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.Diagnostico || !editForm.Kilometraje) { setEditError('Diagnóstico y kilometraje son obligatorios.'); return; }
    const result = await dispatch(updateOrden({ id: editingId, data: editForm }));
    if (!result.error) { setShowEdit(false); dispatch(fetchOrdenes()); }
    else setEditError(result.payload || 'Error al actualizar.');
  };

  const handleAvanzarEstado = (newEstado) => {
    if (!detailId) return;
    dispatch(toggleOrdenEstado({ id: detailId, Estado: newEstado }));
    dispatch(fetchOrdenById(detailId));
    dispatch(fetchOrdenes());
  };

  const handleAddServicio = async (e) => {
    e.preventDefault();
    if (!addServForm.Id_Servicio || !addServForm.precio_unitario) { setAddServError('Selecciona un servicio e ingresa el precio.'); return; }
    const result = await dispatch(addServicioToOrden({ id: detailId, data: addServForm }));
    if (!result.error) { setAddServForm({ Id_Servicio: '', precio_unitario: '' }); setAddServError(''); dispatch(fetchOrdenById(detailId)); }
    else setAddServError(result.payload || 'Error al agregar servicio.');
  };

  // Auto-fill price when selecting a repuesto
  const handleRepuestoSelect = (e) => {
    const id = e.target.value;
    const rep = repuestosOpts.find(r => String(r.Id_Repuesto) === String(id));
    setAddRepForm(p => ({ ...p, Id_Repuesto: id, precio_unitario: (rep?.Precio ?? rep?.PrecioVenta) ? String(rep?.Precio ?? rep?.PrecioVenta) : '' }));
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
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" title="Ver detalle" onClick={() => setDetailId(row.Id_Orden)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" title="Editar" onClick={() => openEdit(row)}><MdEdit size={17} /></button>
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Ã“rdenes de trabajo</h1>
          <p className="page__subtitle">{items.length} orden(es) registrada(s)</p>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por vehículo, cliente, diagnóstico..."
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
        <Table columns={columns} data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron órdenes de trabajo" />
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!detailId} onClose={() => setDetailId(null)} title="Orden de trabajo" size="xl"
        footer={selected ? <button className="btn btn--primary" onClick={() => generarFacturaOrden(selected)}>Facturar (PDF)</button> : null}
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
              <div style={{ marginTop: '1rem' }}>
                <div className="detail-grid">
                  <div className="detail-item"><span className="detail-label">Vehículo</span><span className="detail-value">{selected.Vehiculo || selected.Placa || '—'}</span></div>
                  <div className="detail-item"><span className="detail-label">Cliente</span><span className="detail-value">{selected.Cliente || '—'}</span></div>
                  <div className="detail-item"><span className="detail-label">Fecha de ingreso</span><span className="detail-value">{formatDate(selected.FechaIngreso)}</span></div>
                  <div className="detail-item"><span className="detail-label">Fecha de entrega</span><span className="detail-value">{formatDate(selected.FechaEntrega)}</span></div>
                  <div className="detail-item"><span className="detail-label">Kilometraje</span><span className="detail-value">{selected.Kilometraje ? `${Number(selected.Kilometraje).toLocaleString('es-CO')} km` : '—'}</span></div>
                  <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><EstadoBadge estado={selected.Estado} /></span></div>
                  <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Diagnóstico</span><span className="detail-value">{selected.Diagnostico || '—'}</span></div>
                </div>

                {/* Visual progress stepper */}
                <div style={{ marginTop: '1.5rem' }}>
                  <p className="detail-label" style={{ marginBottom: '0.875rem' }}>Progreso de la orden</p>
                  <ProgresoEstado
                    estadoActual={selected.Estado}
                    onAvanzar={handleAvanzarEstado}
                    loading={actionLoading}
                  />
                </div>

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

                <div className="orden-total-card" style={{ marginTop: '1.25rem' }}>
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
              <div style={{ marginTop: '1rem' }}>
                <div className="orden-items-list">
                  {selected?.servicios?.length > 0 ? (
                    selected.servicios.map((s, i) => (
                      <div key={i} className="orden-item-row">
                        <span className="orden-item-name">{s.servicio || s.Nombre || s.nombre || `Servicio #${s.Id_Servicio}`}</span>
                        <span className="orden-item-price">{formatCurrency(s.precio_unitario || s.Precio)}</span>
                      </div>
                    ))
                  ) : <p className="empty-list">No hay servicios agregados.</p>}
                </div>

                <div className="mano-de-obra-section">
                  <div className="mano-de-obra-header">
                    <MdBuild size={16} className="mano-de-obra-icon" />
                    <span className="mano-de-obra-title">Mano de obra</span>
                  </div>
                  {manoDeObra != null && !editingMano ? (
                    <div className="mano-de-obra-row">
                      <span className="mano-de-obra-value">{formatCurrency(manoDeObra)}</span>
                      <button className="btn btn--outline btn--sm" onClick={() => { setManoInput(String(manoDeObra)); setEditingMano(true); }}>
                        <MdEdit size={15} /> Editar
                      </button>
                    </div>
                  ) : (
                    <div className="mano-de-obra-form">
                      <input type="number" min="0" className="form-control" placeholder="Valor mano de obra..." value={manoInput} onChange={e => setManoInput(e.target.value)} />
                      <button className="btn btn--primary btn--sm" onClick={handleSetMano} disabled={actionLoading || !manoInput}>
                        {actionLoading ? 'Guardando...' : 'Guardar'}
                      </button>
                      {editingMano && <button className="btn btn--outline btn--sm" onClick={() => { setEditingMano(false); setManoInput(''); }}>Cancelar</button>}
                    </div>
                  )}
                </div>

                <div className="orden-subtotal">
                  <span>Subtotal servicios + mano de obra</span>
                  <span>{formatCurrency(totalServicios + (manoDeObra || 0))}</span>
                </div>

                <div className="orden-add-form">
                  <h4>Agregar servicio</h4>
                  {addServError && <div className="form-error-box" style={{ marginBottom: '0.5rem' }}>{addServError}</div>}
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
                    {addServForm.precio_unitario && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>= {formatCurrency(addServForm.precio_unitario)}</span>}
                    <button className="btn btn--primary btn--sm" onClick={handleAddServicio} disabled={actionLoading}><MdAdd size={16} />Agregar</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'repuestos' && (
              <div style={{ marginTop: '1rem' }}>
                <div className="orden-items-list">
                  {selected?.repuestos?.length > 0 ? (
                    selected.repuestos.map((r, i) => {
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
                        </div>
                      );
                    })
                  ) : <p className="empty-list">No hay repuestos agregados.</p>}
                </div>

                <div className="orden-subtotal">
                  <span>Total repuestos</span>
                  <span>{formatCurrency(totalRepuestos)}</span>
                </div>

                <div className="orden-add-form">
                  <h4>Agregar repuesto</h4>
                  {addRepError && <div className="form-error-box" style={{ marginBottom: '0.5rem' }}>{addRepError}</div>}
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
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.375rem' }}>
                      Precio por defecto: {formatCurrency(addRepForm.precio_unitario)} — puedes modificarlo para esta orden.
                    </p>
                  )}
                </div>
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
          <div className="form-group"><label className="form-label">Fecha de ingreso</label><input name="FechaIngreso" type="date" className="form-control" value={editForm.FechaIngreso} onChange={e => setEditForm(p => ({ ...p, FechaIngreso: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Fecha de entrega</label><input name="FechaEntrega" type="date" className="form-control" value={editForm.FechaEntrega} onChange={e => setEditForm(p => ({ ...p, FechaEntrega: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Kilometraje <span className="required">*</span></label><input name="Kilometraje" type="number" min="0" className="form-control" value={editForm.Kilometraje} onChange={e => setEditForm(p => ({ ...p, Kilometraje: e.target.value }))} /></div>
          <div className="form-group span-2"><label className="form-label">Diagnóstico <span className="required">*</span></label><textarea name="Diagnostico" className="form-control" value={editForm.Diagnostico} onChange={e => setEditForm(p => ({ ...p, Diagnostico: e.target.value }))} rows={4} /></div>
        </form>
      </Modal>
    </div>
  );
}

