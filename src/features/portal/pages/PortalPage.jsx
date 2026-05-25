import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdCheck, MdCameraAlt, MdDirectionsCar } from 'react-icons/md';
import { logout, updateCliente } from '../../auth/slices/authSlice.js';
import PortalSidebar from '../components/PortalSidebar.jsx';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import Badge from '../../../shared/components/Badge/Badge.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { filterItems, formatDate, formatCurrency } from '../../../shared/utils/helpers.js';
import api from '../../../shared/services/api.js';
import './PortalPage.css';

const ORDEN_ESTADO = {
  0: { label: 'Inactivo',   variant: 'gray'    },
  1: { label: 'Pendiente',  variant: 'warning' },
  2: { label: 'En proceso', variant: 'info'    },
  3: { label: 'Realizado',  variant: 'success' },
};
function OrdenEstadoBadge({ estado }) {
  const cfg = ORDEN_ESTADO[estado] ?? ORDEN_ESTADO[1];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export default function PortalPage() {
  const dispatch = useDispatch();
  const { cliente, token, tipo } = useSelector(s => s.auth);

  const [tab, setTab] = useState('cuenta');
  const [vehiculos, setVehiculos] = useState([]);
  const [ordenes, setOrdenes]     = useState([]);
  const [citas, setCitas]         = useState([]);
  const [loading, setLoading]     = useState(false);

  /* ── MI CUENTA ───────────────────────────────────────────── */
  const [editData,    setEditData]    = useState({});
  const [fotoPreview, setFotoPreview] = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [saveOk,      setSaveOk]      = useState(false);
  const fileRef = useRef(null);

  /* ── MIS VEHÍCULOS ───────────────────────────────────────── */
  const [vehSearch,   setVehSearch]   = useState('');
  const [vehPageSize, setVehPageSize] = useState(5);
  const [vehDetail,   setVehDetail]   = useState(null);

  /* ── MIS ÓRDENES ─────────────────────────────────────────── */
  const [ordSearch,    setOrdSearch]    = useState('');
  const [ordEstado,    setOrdEstado]    = useState('todos');
  const [ordPageSize,  setOrdPageSize]  = useState(5);
  const [ordDetail,    setOrdDetail]    = useState(null);
  const [ordLoading,   setOrdLoading]   = useState(false);
  const [ordTab,       setOrdTab]       = useState('info');
  const [ordVehFilter, setOrdVehFilter] = useState('');

  /* ── MIS CITAS ───────────────────────────────────────────── */
  const [citaSearch,    setCitaSearch]    = useState('');
  const [citaEstado,    setCitaEstado]    = useState('todos');
  const [citaPageSize,  setCitaPageSize]  = useState(5);
  const [showCitaModal, setShowCitaModal] = useState(false);
  const [citaForm,      setCitaForm]      = useState({ Id_Vehiculo: '', Fecha: '', Hora: '', Descripcion: '', Id_Empleado: '' });
  const [citaError,     setCitaError]     = useState('');
  const [citaLoading,   setCitaLoading]   = useState(false);
  const [citaToast,     setCitaToast]     = useState(false);
  const [empleadosDisp, setEmpleadosDisp] = useState([]);
  const [loadingEmpl,   setLoadingEmpl]   = useState(false);

  /* ── Fetch inicial ───────────────────────────────────────── */
  useEffect(() => {
    if (cliente) {
      setEditData({ Correo: cliente.Correo || '', Telefono: cliente.Telefono || cliente.Contacto || '' });
      setFotoPreview(cliente.Foto || null);
    }
  }, [cliente?.Id_Cliente]);

  useEffect(() => {
    if (!cliente || !token || tipo !== 'cliente') return;
    setLoading(true);
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      api.get('/api/portal/vehiculos', { headers: h }),
      api.get('/api/portal/ordenes',   { headers: h }),
      api.get('/api/portal/citas',     { headers: h }),
    ]).then(([vRes, oRes, cRes]) => {
      setVehiculos(vRes.data?.data || []);
      setOrdenes(oRes.data?.data || []);
      setCitas(flattenCitas(cRes.data?.data || []));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [cliente?.Id_Cliente, token]);

  const flattenCitas = list => list.map(c => ({
    ...c,
    VehiculoPlaca:  c.vehiculo?.Placa || '',
    EmpleadoNombre: c.empleado?.Nombre || 'Sin asignar',
  }));

  /* ── Mi Cuenta ───────────────────────────────────────────── */
  const handleFotoChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setFotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/api/portal/perfil', {
        Correo: editData.Correo, Contacto: editData.Telefono,
      }, { headers: { Authorization: `Bearer ${token}` } });
      dispatch(updateCliente({ ...(res.data?.data || {}), Foto: fotoPreview }));
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch { } finally { setSaving(false); }
  };

  /* ── Orden detail ────────────────────────────────────────── */
  const openOrden = async orden => {
    setOrdDetail(null);
    setOrdTab('info');
    setOrdLoading(true);
    try {
      const r = await api.get(`/api/portal/ordenes/${orden.Id_Orden}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrdDetail(r.data?.data || orden);
    } catch { setOrdDetail(orden); }
    finally { setOrdLoading(false); }
  };

  /* ── Citas ───────────────────────────────────────────────── */
  const refetchCitas = async () => {
    try {
      const r = await api.get('/api/portal/citas', { headers: { Authorization: `Bearer ${token}` } });
      setCitas(flattenCitas(r.data?.data || []));
    } catch { }
  };

  const fetchEmpleadosDisp = async fecha => {
    if (!fecha) { setEmpleadosDisp([]); return; }
    setLoadingEmpl(true);
    try {
      const r = await api.get(`/api/portal/empleados-disponibles?fecha=${fecha}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEmpleadosDisp(r.data?.data || []);
    } catch { setEmpleadosDisp([]); }
    finally { setLoadingEmpl(false); }
  };

  const handleCrearCita = async e => {
    e.preventDefault();
    setCitaError('');
    if (!citaForm.Id_Vehiculo || !citaForm.Fecha || !citaForm.Hora) {
      setCitaError('Vehículo, fecha y hora son obligatorios.'); return;
    }
    setCitaLoading(true);
    try {
      await api.post('/api/portal/citas', citaForm, { headers: { Authorization: `Bearer ${token}` } });
      setShowCitaModal(false);
      setCitaForm({ Id_Vehiculo: '', Fecha: '', Hora: '', Descripcion: '', Id_Empleado: '' });
      setEmpleadosDisp([]);
      await refetchCitas();
      setCitaToast(true);
      setTimeout(() => setCitaToast(false), 3000);
    } catch (err) {
      setCitaError(err.response?.data?.message || 'Error al crear la cita.');
    } finally { setCitaLoading(false); }
  };

  /* ── Filtered lists ──────────────────────────────────────── */
  const filteredVehiculos = filterItems(vehiculos, vehSearch, ['Placa', 'Marca', 'Modelo', 'Color']);

  const filteredOrdenes = (() => {
    let list = ordenes;
    if (ordVehFilter) list = list.filter(o => String(o.Id_Vehiculo) === ordVehFilter);
    if (ordEstado !== 'todos') list = list.filter(o => String(o.Estado) === ordEstado);
    return filterItems(list, ordSearch, ['Vehiculo', 'vehiculo', 'Diagnostico', 'Cliente', 'cliente']);
  })();

  const filteredCitas = (() => {
    let list = citas;
    if (citaEstado === 'activos')   list = list.filter(c => c.Estado !== 0);
    if (citaEstado === 'inactivos') list = list.filter(c => c.Estado === 0);
    return filterItems(list, citaSearch, ['VehiculoPlaca', 'EmpleadoNombre', 'Descripcion']);
  })();

  /* ── Orden totals ────────────────────────────────────────── */
  const totalServ = (ordDetail?.servicios || []).reduce((s, x) => s + Number(x.precio_unitario || 0), 0);
  const totalRep  = (ordDetail?.repuestos  || []).reduce((s, x) => s + Number(x.cantidad || 1) * Number(x.precio_unitario || 0), 0);
  const manoObra  = ordDetail?.mano_de_obra ?? null;
  const total     = totalServ + totalRep + (manoObra || 0);

  /* ── Column definitions ──────────────────────────────────── */
  const vehiculosColumns = [
    { key: '#',      label: '#',      width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Placa',  label: 'Placa',  render: v => <span className="font-medium">{v}</span> },
    { key: 'Marca',  label: 'Marca'  },
    { key: 'Modelo', label: 'Modelo' },
    { key: 'Anio',   label: 'Año'    },
    { key: 'Color',  label: 'Color',  render: v => v || '—' },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" title="Ver detalle" onClick={() => setVehDetail(row)}>
            <MdVisibility size={17} />
          </button>
          <button className="btn btn--ghost btn--sm portal-btn-ordenes" title="Ver órdenes de este vehículo"
            onClick={() => { setOrdVehFilter(String(row.Id_Vehiculo)); setTab('ordenes'); }}>
            <MdDirectionsCar size={15} /> Ver órdenes
          </button>
        </div>
      ),
    },
  ];

  const ordenesColumns = [
    { key: '#',          label: '#',          width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Vehiculo',   label: 'Vehículo',   render: (v, row) => <span className="font-medium">{v || row.vehiculo || `#${row.Id_Vehiculo}`}</span> },
    { key: 'Diagnostico',label: 'Diagnóstico', render: v => <span className="diag-cell">{v || '—'}</span> },
    { key: 'FechaIngreso',label: 'Ingreso',   render: v => formatDate(v) },
    { key: 'FechaEntrega',label: 'Entrega',   render: v => formatDate(v) },
    { key: 'Estado',     label: 'Estado',     render: v => <OrdenEstadoBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" title="Ver detalle" onClick={() => openOrden(row)}>
            <MdVisibility size={17} />
          </button>
        </div>
      ),
    },
  ];

  const citasColumns = [
    { key: '#',                label: '#',         width: '50px', render: (_, __, i) => i + 1 },
    { key: 'FechaAgendamiento',label: 'Fecha',     render: v => formatDate(v) },
    { key: 'Hora',             label: 'Hora',      render: v => v || '—' },
    { key: 'VehiculoPlaca',    label: 'Vehículo',  render: v => v || '—' },
    { key: 'EmpleadoNombre',   label: 'Técnico',   render: v => v || 'Sin asignar' },
    { key: 'Descripcion',      label: 'Descripción', render: v => v ? <span className="diag-cell">{v}</span> : '—' },
    { key: 'Estado',           label: 'Estado',    render: v => <StatusBadge estado={v} /> },
  ];

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="portal-layout">
      <PortalSidebar activeTab={tab} onTabChange={setTab} />

      <main className="portal-layout__main">

        {/* ════════════════════ MI CUENTA ════════════════════ */}
        {tab === 'cuenta' && (
          <div className="page">
            <div className="page__header">
              <div>
                <h1 className="page__title">Mi Cuenta</h1>
                <p className="page__subtitle">Gestiona tu información personal</p>
              </div>
            </div>

            <div className="portal-profile-wrap">
              {saveOk && (
                <div className="portal-toast">
                  <MdCheck size={16} /> Datos actualizados correctamente
                </div>
              )}

              {/* Card 1: avatar + nombre + doc + botón cambiar foto */}
              <div className="portal-profile-card portal-profile-header-card">
                {fotoPreview
                  ? <img src={fotoPreview} alt="avatar" className="portal-profile-avatar" />
                  : <div className="portal-profile-avatar portal-profile-avatar--init">{cliente?.Nombre?.charAt(0)?.toUpperCase()}</div>
                }
                <div className="portal-profile-user-info">
                  <span className="portal-profile-user-name">{cliente?.Nombre}</span>
                  <span className="portal-profile-user-subdoc">{cliente?.TipoDocumento}</span>
                  <span className="portal-profile-user-doc">{cliente?.Documento}</span>
                </div>
                <button className="btn btn--outline btn--sm" onClick={() => fileRef.current?.click()}>
                  <MdCameraAlt size={15} /> Cambiar foto
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoChange} />
              </div>

              {/* Card 2: información personal (solo lectura) */}
              <div className="portal-profile-card">
                <div className="portal-profile-card-title">Información personal</div>
                <div className="portal-profile-fields">
                  {[
                    ['Nombre completo',     cliente?.Nombre],
                    ['Tipo de documento',   cliente?.TipoDocumento],
                    ['Número de documento', cliente?.Documento],
                  ].map(([label, value]) => (
                    <div key={label} className="portal-profile-field">
                      <span className="portal-profile-field-label">{label}</span>
                      <input
                        className="portal-profile-field-input portal-profile-field-input--readonly"
                        value={value || '—'}
                        disabled
                        readOnly
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 3: datos de contacto (editables) */}
              <form onSubmit={handleSave}>
                <div className="portal-profile-card">
                  <div className="portal-profile-card-title">Datos de contacto</div>
                  <div className="portal-profile-fields">
                    <div className="portal-profile-field">
                      <span className="portal-profile-field-label">Correo electrónico</span>
                      <input
                        type="email"
                        className="portal-profile-field-input"
                        value={editData.Correo}
                        onChange={e => setEditData(p => ({ ...p, Correo: e.target.value }))}
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div className="portal-profile-field">
                      <span className="portal-profile-field-label">Teléfono</span>
                      <input
                        className="portal-profile-field-input"
                        value={editData.Telefono}
                        onChange={e => setEditData(p => ({ ...p, Telefono: e.target.value }))}
                        placeholder="Número de teléfono"
                      />
                    </div>
                  </div>
                  <div className="portal-profile-card-footer">
                    <button type="submit" className="btn btn--primary" disabled={saving}>
                      {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════ MIS VEHÍCULOS ═════════════════════ */}
        {tab === 'vehiculos' && (
          <div className="page">
            <div className="page__header">
              <div>
                <h1 className="page__title">Mis Vehículos</h1>
                <p className="page__subtitle">{vehiculos.length} vehículo(s) registrado(s)</p>
              </div>
            </div>
            <div className="card">
              <div className="card__header">
                <SearchBar
                  value={vehSearch}
                  onChange={setVehSearch}
                  placeholder="Buscar por placa, marca, modelo, color..."
                  filterSlot={
                    <FilterDropdown
                      statusFilter="todos"
                      onStatusChange={() => {}}
                      pageSize={vehPageSize}
                      onPageSizeChange={setVehPageSize}
                    />
                  }
                />
              </div>
              <Table
                columns={vehiculosColumns}
                data={filteredVehiculos}
                loading={loading}
                pageSize={vehPageSize}
                emptyMessage="No tienes vehículos registrados"
              />
            </div>
          </div>
        )}

        {/* ═══════════════ MIS ÓRDENES ═══════════════════════ */}
        {tab === 'ordenes' && (
          <div className="page">
            <div className="page__header">
              <div>
                <h1 className="page__title">Mis Órdenes de Trabajo</h1>
                <p className="page__subtitle">{ordenes.length} orden(es) registrada(s)</p>
              </div>
              {ordVehFilter && (
                <button className="btn btn--outline btn--sm" onClick={() => setOrdVehFilter('')}>
                  Quitar filtro de vehículo
                </button>
              )}
            </div>
            <div className="card">
              <div className="card__header">
                <SearchBar
                  value={ordSearch}
                  onChange={setOrdSearch}
                  placeholder="Buscar por vehículo, diagnóstico..."
                  filterSlot={
                    <>
                      <select className="filter-select" value={ordEstado} onChange={e => setOrdEstado(e.target.value)}>
                        <option value="todos">Todos los estados</option>
                        <option value="1">Pendiente</option>
                        <option value="2">En proceso</option>
                        <option value="3">Realizado</option>
                        <option value="0">Inactivo</option>
                      </select>
                      <FilterDropdown
                        statusFilter="todos"
                        onStatusChange={() => {}}
                        pageSize={ordPageSize}
                        onPageSizeChange={setOrdPageSize}
                      />
                    </>
                  }
                />
              </div>
              <Table
                columns={ordenesColumns}
                data={filteredOrdenes}
                loading={loading}
                pageSize={ordPageSize}
                emptyMessage="No tienes órdenes registradas"
              />
            </div>
          </div>
        )}

        {/* ═══════════════ MIS CITAS ═════════════════════════ */}
        {tab === 'citas' && (
          <div className="page">
            <div className="page__header">
              <div>
                <h1 className="page__title">Mis Citas</h1>
                <p className="page__subtitle">{citas.length} cita(s) registrada(s)</p>
              </div>
              <button className="btn btn--primary" onClick={() => {
                setCitaForm({ Id_Vehiculo: '', Fecha: '', Hora: '', Descripcion: '', Id_Empleado: '' });
                setCitaError(''); setEmpleadosDisp([]); setShowCitaModal(true);
              }}>
                <MdAdd size={18} /> Agendar cita
              </button>
            </div>

            {citaToast && (
              <div className="portal-toast">
                <MdCheck size={16} /> Cita agendada exitosamente
              </div>
            )}

            <div className="card">
              <div className="card__header">
                <SearchBar
                  value={citaSearch}
                  onChange={setCitaSearch}
                  placeholder="Buscar por vehículo, técnico, descripción..."
                  filterSlot={
                    <FilterDropdown
                      statusFilter={citaEstado}
                      onStatusChange={setCitaEstado}
                      pageSize={citaPageSize}
                      onPageSizeChange={setCitaPageSize}
                    />
                  }
                />
              </div>
              <Table
                columns={citasColumns}
                data={filteredCitas}
                loading={loading}
                pageSize={citaPageSize}
                emptyMessage="No tienes citas registradas"
              />
            </div>
          </div>
        )}

      </main>

      {/* ══════════════ MODAL: Detalle vehículo ══════════════ */}
      <Modal isOpen={!!vehDetail} onClose={() => setVehDetail(null)} title="Detalle del vehículo" size="md">
        {vehDetail && (
          <div className="detail-grid">
            <div className="detail-item"><span className="detail-label">Placa</span><span className="detail-value">{vehDetail.Placa}</span></div>
            <div className="detail-item"><span className="detail-label">VIN</span><span className="detail-value">{vehDetail.VIN || '—'}</span></div>
            <div className="detail-item"><span className="detail-label">Marca</span><span className="detail-value">{vehDetail.Marca || '—'}</span></div>
            <div className="detail-item"><span className="detail-label">Modelo</span><span className="detail-value">{vehDetail.Modelo}</span></div>
            <div className="detail-item"><span className="detail-label">Año</span><span className="detail-value">{vehDetail.Anio}</span></div>
            <div className="detail-item"><span className="detail-label">Color</span><span className="detail-value">{vehDetail.Color || '—'}</span></div>
          </div>
        )}
      </Modal>

      {/* ══════════════ MODAL: Detalle orden ═════════════════ */}
      <Modal
        isOpen={!!(ordDetail || ordLoading)}
        onClose={() => { setOrdDetail(null); }}
        title={ordDetail ? `Orden de trabajo #${ordDetail.Id_Orden}` : 'Orden de trabajo'}
        size="xl"
      >
        {ordLoading && !ordDetail ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Cargando detalle...</div>
        ) : ordDetail ? (
          <div>
            <div className="orden-tabs">
              {[['info', 'Información general'], ['servicios', 'Servicios'], ['repuestos', 'Repuestos']].map(([key, label]) => (
                <button key={key} className={`orden-tab${ordTab === key ? ' orden-tab--active' : ''}`} onClick={() => setOrdTab(key)}>
                  {label}
                </button>
              ))}
            </div>

            {ordTab === 'info' && (
              <div style={{ marginTop: '1rem' }}>
                <div className="detail-grid">
                  <div className="detail-item"><span className="detail-label">Vehículo</span><span className="detail-value">{ordDetail.Vehiculo || ordDetail.vehiculo || `#${ordDetail.Id_Vehiculo}`}</span></div>
                  <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><OrdenEstadoBadge estado={ordDetail.Estado} /></span></div>
                  <div className="detail-item"><span className="detail-label">Fecha ingreso</span><span className="detail-value">{formatDate(ordDetail.FechaIngreso)}</span></div>
                  <div className="detail-item"><span className="detail-label">Fecha entrega</span><span className="detail-value">{formatDate(ordDetail.FechaEntrega)}</span></div>
                  <div className="detail-item"><span className="detail-label">Kilometraje</span><span className="detail-value">{ordDetail.Kilometraje ? `${Number(ordDetail.Kilometraje).toLocaleString('es-CO')} km` : '—'}</span></div>
                  <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Diagnóstico</span><span className="detail-value">{ordDetail.Diagnostico || '—'}</span></div>
                </div>
                <div className="orden-total-card">
                  <div className="orden-total-breakdown">
                    <div className="orden-total-row"><span>Servicios</span><span>{formatCurrency(totalServ)}</span></div>
                    <div className="orden-total-row"><span>Repuestos</span><span>{formatCurrency(totalRep)}</span></div>
                    <div className="orden-total-row"><span>Mano de obra</span><span>{manoObra != null ? formatCurrency(manoObra) : '—'}</span></div>
                  </div>
                  <div className="orden-total-final">
                    <span>Total estimado</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            )}

            {ordTab === 'servicios' && (
              <div style={{ marginTop: '1rem' }}>
                <div className="orden-items-list">
                  {(ordDetail.servicios || []).length > 0
                    ? (ordDetail.servicios || []).map((s, i) => (
                      <div key={i} className="orden-item-row">
                        <span className="orden-item-name" style={{ flex: 1 }}>{s.servicio || s.Nombre || `Servicio #${s.Id_Servicio}`}</span>
                        <span className="orden-item-price">{formatCurrency(s.precio_unitario)}</span>
                      </div>
                    ))
                    : <p className="empty-list">No hay servicios registrados en esta orden.</p>
                  }
                </div>
                <div className="orden-subtotal">
                  <span>Subtotal servicios</span>
                  <span>{formatCurrency(totalServ)}</span>
                </div>
              </div>
            )}

            {ordTab === 'repuestos' && (
              <div style={{ marginTop: '1rem' }}>
                <div className="orden-items-list">
                  {(ordDetail.repuestos || []).length > 0
                    ? (ordDetail.repuestos || []).map((r, i) => (
                      <div key={i} className="orden-item-row">
                        <span className="orden-item-name" style={{ flex: 1 }}>{r.repuesto || r.Nombre || `Repuesto #${r.Id_Repuesto}`}</span>
                        <span className="orden-item-qty">x{r.cantidad || r.Cantidad}</span>
                        <span className="orden-item-price">{formatCurrency(Number(r.cantidad || 1) * Number(r.precio_unitario || 0))}</span>
                      </div>
                    ))
                    : <p className="empty-list">No hay repuestos registrados en esta orden.</p>
                  }
                </div>
                <div className="orden-subtotal">
                  <span>Total repuestos</span>
                  <span>{formatCurrency(totalRep)}</span>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* ══════════════ MODAL: Nueva cita ════════════════════ */}
      <Modal
        isOpen={showCitaModal}
        onClose={() => { setShowCitaModal(false); setEmpleadosDisp([]); }}
        title="Agendar nueva cita"
        size="md"
        footer={
          <>
            <button className="btn btn--outline" onClick={() => { setShowCitaModal(false); setEmpleadosDisp([]); }}>Cancelar</button>
            <button className="btn btn--primary" onClick={handleCrearCita} disabled={citaLoading}>
              {citaLoading ? 'Guardando...' : 'Agendar cita'}
            </button>
          </>
        }
      >
        {citaError && <div className="form-error-box">{citaError}</div>}
        <form className="form-grid" onSubmit={handleCrearCita} noValidate>
          <div className="form-group">
            <label className="form-label">Vehículo <span className="required">*</span></label>
            <select className="form-control" value={citaForm.Id_Vehiculo} onChange={e => setCitaForm(p => ({ ...p, Id_Vehiculo: e.target.value }))} required>
              <option value="">Seleccionar vehículo...</option>
              {vehiculos.map(v => <option key={v.Id_Vehiculo} value={v.Id_Vehiculo}>{v.Placa} — {v.Marca || ''}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Fecha <span className="required">*</span></label>
            <input type="date" className="form-control" value={citaForm.Fecha}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => {
                const f = e.target.value;
                setCitaForm(p => ({ ...p, Fecha: f, Id_Empleado: '' }));
                fetchEmpleadosDisp(f);
              }} required />
          </div>
          <div className="form-group">
            <label className="form-label">Hora <span className="required">*</span></label>
            <select className="form-control" value={citaForm.Hora} onChange={e => setCitaForm(p => ({ ...p, Hora: e.target.value }))} required>
              <option value="">Seleccionar hora...</option>
              {Array.from({ length: 21 }, (_, i) => {
                const mins  = 480 + i * 30;
                const h     = Math.floor(mins / 60);
                const m     = mins % 60;
                const label = `${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                return <option key={value} value={value}>{label}</option>;
              })}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Técnico asignado <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>(opcional)</span></label>
            {!citaForm.Fecha ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>Selecciona una fecha primero</p>
            ) : loadingEmpl ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>Cargando técnicos...</p>
            ) : (
              <select className="form-control" value={citaForm.Id_Empleado} onChange={e => setCitaForm(p => ({ ...p, Id_Empleado: e.target.value }))}>
                <option value="">Sin preferencia</option>
                {empleadosDisp.map(e => (
                  <option key={e.id_empleado} value={e.id_empleado} disabled={!e.disponible}>
                    {e.Nombre}{!e.disponible ? ' (No disponible)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="form-group span-2">
            <label className="form-label">Descripción</label>
            <textarea className="form-control" value={citaForm.Descripcion} rows={3} maxLength={300}
              onChange={e => setCitaForm(p => ({ ...p, Descripcion: e.target.value }))}
              placeholder="Describe brevemente el motivo de la cita..." />
          </div>
        </form>
      </Modal>

    </div>
  );
}
