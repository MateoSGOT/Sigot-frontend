import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  MdPerson, MdDirectionsCar, MdAssignment, MdCalendarMonth,
  MdCameraAlt, MdClose, MdAdd, MdCheck,
  MdCalendarToday, MdAccessTime, MdFlag, MdChevronRight,
} from 'react-icons/md';
import { logout, updateCliente } from '../../auth/slices/authSlice.js';
import PortalSidebar from '../components/PortalSidebar.jsx';
import api from '../../../shared/services/api.js';
import './PortalPage.css';

/* ── helpers ─────────────────────────────────────────────── */
const fmtCurrency = v => v != null ? `$${Number(v).toLocaleString('es-CO')}` : '—';
const fmtDate = v => {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return v; }
};

const STATE_BADGE = {
  1: { label: 'Activa',     cls: 'badge--success', border: '#16a34a' },
  0: { label: 'Completada', cls: 'badge--green',   border: '#6b7280' },
  2: { label: 'Pendiente',  cls: 'badge--yellow',  border: '#ca8a04' },
  3: { label: 'En proceso', cls: 'badge--blue',    border: '#1d4ed8' },
  4: { label: 'Cancelada',  cls: 'badge--red',     border: '#dc2626' },
};

function StateBadge({ estado }) {
  const info = STATE_BADGE[estado] || { label: `Estado ${estado}`, cls: 'badge--gray', border: '#6b7280' };
  return <span className={`portal-badge ${info.cls}`}>{info.label}</span>;
}

const BRAND_COLORS = ['#16a34a','#2563eb','#9333ea','#ea580c','#0891b2'];
const brandColor = name => BRAND_COLORS[name?.charCodeAt(0) % BRAND_COLORS.length] || '#16a34a';

/* ── Main portal ─────────────────────────────────────────── */
export default function PortalPage() {
  const dispatch = useDispatch();
  const { cliente, token, tipo } = useSelector(s => s.auth);

  const [tab, setTab] = useState('cuenta');
  const [vehiculos, setVehiculos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(false);

  const [editData, setEditData] = useState({});
  const [fotoPreview, setFotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const fileRef = useRef(null);

  const [detailVeh, setDetailVeh] = useState(null);
  const [detailOrden, setDetailOrden] = useState(null);
  const [loadingOrden, setLoadingOrden] = useState(false);

  const [citas, setCitas] = useState([]);
  const [showCitaModal, setShowCitaModal] = useState(false);
  const [citaForm, setCitaForm] = useState({ Id_Vehiculo: '', Fecha: '', Hora: '', Descripcion: '', Id_Empleado: '' });
  const [citaError, setCitaError] = useState('');
  const [citaLoading, setCitaLoading] = useState(false);
  const [citaToast, setCitaToast] = useState(false);
  const [empleadosDisponibles, setEmpleadosDisponibles] = useState([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(false);

  useEffect(() => {
    if (cliente) {
      setEditData({ Correo: cliente.Correo || '', Telefono: cliente.Telefono || cliente.Contacto || '' });
      setFotoPreview(cliente.Foto || null);
    }
  }, [cliente?.Id_Cliente]);

  useEffect(() => {
    if (!cliente || !token || tipo !== 'cliente') return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      api.get('/api/portal/vehiculos', { headers }),
      api.get('/api/portal/ordenes',   { headers }),
      api.get('/api/portal/citas',     { headers }),
    ]).then(([vRes, oRes, cRes]) => {
      setVehiculos(vRes.data?.data || []);
      setOrdenes(oRes.data?.data   || []);
      setCitas(cRes.data?.data     || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [cliente?.Id_Cliente, token]);

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
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const fetchCitas = async () => {
    try {
      const r = await api.get('/api/portal/citas', { headers: { Authorization: `Bearer ${token}` } });
      setCitas(r.data?.data || []);
    } catch { /* silent */ }
  };

  const fetchEmpleadosDisponibles = async fecha => {
    if (!fecha) { setEmpleadosDisponibles([]); return; }
    setLoadingEmpleados(true);
    try {
      const r = await api.get(`/api/portal/empleados-disponibles?fecha=${fecha}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEmpleadosDisponibles(r.data?.data || []);
    } catch { setEmpleadosDisponibles([]); }
    finally { setLoadingEmpleados(false); }
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
      setEmpleadosDisponibles([]);
      await fetchCitas();
      setCitaToast(true);
      setTimeout(() => setCitaToast(false), 3000);
    } catch (err) {
      setCitaError(err.response?.data?.message || 'Error al crear la cita.');
    } finally { setCitaLoading(false); }
  };

  const openOrden = async orden => {
    setDetailOrden(null);
    setLoadingOrden(true);
    try {
      const r = await api.get(`/api/portal/ordenes/${orden.Id_Orden}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDetailOrden(r.data?.data || orden);
    } catch { setDetailOrden(orden); }
    finally { setLoadingOrden(false); }
  };

  return (
    <div className="portal-layout">
      <PortalSidebar activeTab={tab} onTabChange={setTab} />

      <main className="portal-layout__main">

        {/* ── MI CUENTA ─────────────────────────────────── */}
        {tab === 'cuenta' && (
          <div className="page">
            <div className="page__header">
              <div>
                <h1 className="page__title">Mi Cuenta</h1>
                <p className="page__subtitle">Gestiona tu información personal</p>
              </div>
            </div>
            <div className="portal-account-grid">
              <div className="portal-avatar-card">
                <div className="portal-avatar-wrap">
                  {fotoPreview
                    ? <img src={fotoPreview} alt="avatar" className="portal-avatar-img" />
                    : <div className="portal-avatar-placeholder">{cliente?.Nombre?.charAt(0)}</div>
                  }
                  <button className="portal-avatar-btn" onClick={() => fileRef.current?.click()}>
                    <MdCameraAlt size={15} /> Cambiar foto
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoChange} />
                </div>
                <div className="portal-avatar-name">{cliente?.Nombre}</div>
                <div className="portal-avatar-doc">{cliente?.TipoDocumento} · {cliente?.Documento}</div>
              </div>

              <form className="portal-account-form" onSubmit={handleSave}>
                {saveOk && (
                  <div className="portal-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MdCheck size={16} /> Datos actualizados correctamente
                  </div>
                )}
                <div className="portal-form-section-title">Datos de solo lectura</div>
                <div className="portal-readonly-grid">
                  {[
                    ['Nombre completo', cliente?.Nombre],
                    ['Tipo de documento', cliente?.TipoDocumento],
                    ['Número de documento', cliente?.Documento],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="portal-readonly-item">
                      <span className="portal-readonly-label">{lbl}</span>
                      <span className="portal-readonly-value">{val || '—'}</span>
                    </div>
                  ))}
                </div>
                <div className="portal-form-section-title">Datos editables</div>
                <div className="portal-editable-grid">
                  <div className="portal-form-group">
                    <label>Correo electrónico</label>
                    <input value={editData.Correo} onChange={e => setEditData(p => ({ ...p, Correo: e.target.value }))} type="email" />
                  </div>
                  <div className="portal-form-group">
                    <label>Teléfono</label>
                    <input value={editData.Telefono} onChange={e => setEditData(p => ({ ...p, Telefono: e.target.value }))} />
                  </div>
                </div>
                <button type="submit" className="portal-btn portal-btn--primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── MIS VEHÍCULOS ──────────────────────────────── */}
        {tab === 'vehiculos' && (
          <div className="page">
            <div className="page__header">
              <div>
                <h1 className="page__title">Mis Vehículos</h1>
                <p className="page__subtitle">{vehiculos.length} vehículo(s) registrado(s)</p>
              </div>
            </div>
            {loading ? (
              <div className="portal-loading">Cargando...</div>
            ) : vehiculos.length === 0 ? (
              <div className="portal-empty">
                <MdDirectionsCar size={44} className="portal-empty__icon" />
                <p>No tienes vehículos registrados aún.</p>
              </div>
            ) : (
              <div className="portal-vehicles-grid">
                {vehiculos.map(v => (
                  <div key={v.Id_Vehiculo} className="portal-vehicle-card">
                    <div className="portal-vehicle-card__icon" style={{ background: brandColor(v.Marca) }}>
                      <MdDirectionsCar size={28} color="#fff" />
                    </div>
                    <div className="portal-vehicle-card__info">
                      <h3 className="portal-vehicle-card__name">{v.Marca} {v.Modelo}</h3>
                      <div className="portal-vehicle-card__placa">{v.Placa}</div>
                      <div className="portal-vehicle-card__meta">
                        <span><MdCalendarToday size={12} style={{ marginRight: '3px', verticalAlign: 'middle' }} />{v.Anio}</span>
                        {v.Color && <span style={{ textTransform: 'capitalize' }}>{v.Color}</span>}
                      </div>
                    </div>
                    <div className="portal-vehicle-card__actions">
                      <button className="portal-btn portal-btn--outline portal-btn--sm" onClick={() => setDetailVeh(v)}>
                        Ver detalles
                      </button>
                      <button className="portal-btn portal-btn--ghost portal-btn--sm" onClick={() => setTab('ordenes')}>
                        Mis órdenes
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MIS ÓRDENES ─────────────────────────────────── */}
        {tab === 'ordenes' && (
          <div className="page">
            <div className="page__header">
              <div>
                <h1 className="page__title">Mis Órdenes de Trabajo</h1>
                <p className="page__subtitle">{ordenes.length} orden(es) registrada(s)</p>
              </div>
            </div>
            {loading ? (
              <div className="portal-loading">Cargando...</div>
            ) : ordenes.length === 0 ? (
              <div className="portal-empty">
                <MdAssignment size={44} className="portal-empty__icon" />
                <p>No tienes órdenes registradas aún.</p>
              </div>
            ) : (
              <div className="portal-orders-list">
                {ordenes.map(o => {
                  const veh = vehiculos.find(v => v.Id_Vehiculo == o.Id_Vehiculo);
                  const borderColor = STATE_BADGE[o.Estado]?.border || '#6b7280';
                  return (
                    <div key={o.Id_Orden} className="portal-order-card" style={{ borderLeft: `3px solid ${borderColor}` }} onClick={() => openOrden(o)}>
                      <div className="portal-order-card__top">
                        <div className="portal-order-card__num">Orden #{o.Id_Orden}</div>
                        <StateBadge estado={o.Estado} />
                      </div>
                      <div className="portal-order-card__vehicle">
                        <MdDirectionsCar size={14} style={{ marginRight: '4px', flexShrink: 0, verticalAlign: 'middle' }} />
                        {veh ? `${veh.Marca} ${veh.Modelo} · ${veh.Placa}` : o.Vehiculo || `Vehículo #${o.Id_Vehiculo}`}
                      </div>
                      <div className="portal-order-card__dates">
                        <span><MdCalendarToday size={12} style={{ marginRight: '3px', verticalAlign: 'middle' }} />Ingreso: {fmtDate(o.FechaIngreso)}</span>
                        {o.FechaEntrega && <span><MdFlag size={12} style={{ marginRight: '3px', verticalAlign: 'middle' }} />Entrega: {fmtDate(o.FechaEntrega)}</span>}
                      </div>
                      <div className="portal-order-card__cta">
                        Ver detalle completo <MdChevronRight size={15} style={{ verticalAlign: 'middle' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MIS CITAS ───────────────────────────────────── */}
        {tab === 'citas' && (
          <div className="page">
            <div className="page__header">
              <div>
                <h1 className="page__title">Mis Citas</h1>
                <p className="page__subtitle">Historial y nuevas citas con el taller</p>
              </div>
              <button className="portal-btn portal-btn--primary" onClick={() => {
                setCitaForm({ Id_Vehiculo: '', Fecha: '', Hora: '', Descripcion: '', Id_Empleado: '' });
                setCitaError(''); setEmpleadosDisponibles([]); setShowCitaModal(true);
              }}>
                <MdAdd size={18} /> Agendar cita
              </button>
            </div>

            {citaToast && (
              <div className="portal-toast">
                <MdCheck size={16} /> Cita agendada exitosamente
              </div>
            )}

            {citas.length === 0 ? (
              <div className="portal-empty">
                <MdCalendarMonth size={44} className="portal-empty__icon" />
                <p>No tienes citas registradas.</p>
              </div>
            ) : (
              <div className="portal-citas-list">
                {citas.map(c => {
                  const isPending = c.Estado;
                  return (
                    <div key={c.Id_Agenda} className={`portal-cita-card${isPending ? '' : ' portal-cita-card--done'}`}>
                      <div className="portal-cita-card__date-col">
                        <div className="portal-cita-card__date">
                          <MdCalendarMonth size={16} />
                          <span>{fmtDate(c.FechaAgendamiento)}</span>
                        </div>
                        <div className="portal-cita-card__time">
                          <MdAccessTime size={14} />
                          <span>{c.Hora || '—'}</span>
                        </div>
                      </div>
                      <div className="portal-cita-card__info">
                        <div className="portal-cita-card__vehiculo">
                          <MdDirectionsCar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                          {c.vehiculo?.Placa || '—'}
                        </div>
                        <div className="portal-cita-card__tecnico">
                          {c.empleado?.Nombre || 'Sin técnico asignado'}
                        </div>
                        {c.Descripcion && <div className="portal-cita-card__desc">{c.Descripcion}</div>}
                      </div>
                      <div className="portal-cita-card__status">
                        <span className={`portal-badge ${isPending ? 'badge--yellow' : 'badge--green'}`}>
                          {isPending ? 'Pendiente' : 'Completada'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── VEHICLE DETAIL MODAL ─────────────────────────── */}
      {detailVeh && (
        <div className="portal-modal-overlay" onClick={() => setDetailVeh(null)}>
          <div className="portal-modal" onClick={e => e.stopPropagation()}>
            <div className="portal-modal__header">
              <h3>Detalle del vehículo</h3>
              <button className="portal-modal__close" onClick={() => setDetailVeh(null)}><MdClose size={18} /></button>
            </div>
            <div className="portal-modal__body">
              <div className="portal-detail-grid">
                {[['Placa', detailVeh.Placa], ['VIN', detailVeh.VIN || '—'], ['Marca', detailVeh.Marca],
                  ['Modelo', detailVeh.Modelo], ['Año', detailVeh.Anio], ['Color', detailVeh.Color || '—'],
                  ['Estado', detailVeh.Estado === 1 ? 'Activo' : 'Inactivo']].map(([l, v]) => (
                  <div key={l} className="portal-detail-item">
                    <span className="portal-detail-label">{l}</span>
                    <span className="portal-detail-value">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NUEVA CITA MODAL ─────────────────────────────── */}
      {showCitaModal && (
        <div className="portal-modal-overlay" onClick={() => { setShowCitaModal(false); setEmpleadosDisponibles([]); }}>
          <div className="portal-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="portal-modal__header">
              <h3>Agendar nueva cita</h3>
              <button className="portal-modal__close" onClick={() => { setShowCitaModal(false); setEmpleadosDisponibles([]); }}><MdClose size={18} /></button>
            </div>
            <div className="portal-modal__body">
              <form onSubmit={handleCrearCita}>
                {citaError && <div style={{ color: '#f87171', marginBottom: '0.75rem', fontSize: '0.85rem' }}>{citaError}</div>}
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '0.25rem' }}>Vehículo *</label>
                  <select className="form-control" value={citaForm.Id_Vehiculo} onChange={e => setCitaForm(p => ({ ...p, Id_Vehiculo: e.target.value }))} required>
                    <option value="">Seleccionar vehículo...</option>
                    {vehiculos.map(v => <option key={v.Id_Vehiculo} value={v.Id_Vehiculo}>{v.Placa} — {v.Marca || ''}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '0.25rem' }}>Fecha *</label>
                  <input type="date" className="form-control" value={citaForm.Fecha} min={new Date().toISOString().split('T')[0]}
                    onChange={e => {
                      const f = e.target.value;
                      setCitaForm(p => ({ ...p, Fecha: f, Id_Empleado: '' }));
                      fetchEmpleadosDisponibles(f);
                    }} required />
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '0.25rem' }}>Hora *</label>
                  <select className="form-control" value={citaForm.Hora} onChange={e => setCitaForm(p => ({ ...p, Hora: e.target.value }))} required>
                    <option value="">Seleccionar hora...</option>
                    {Array.from({ length: 21 }, (_, i) => {
                      const totalMins = 480 + i * 30;
                      const h = Math.floor(totalMins / 60);
                      const m = totalMins % 60;
                      const label = `${h > 12 ? h - 12 : h}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                      const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                      return <option key={value} value={value}>{label}</option>;
                    })}
                  </select>
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '0.25rem' }}>Técnico asignado (opcional)</label>
                  {!citaForm.Fecha ? (
                    <p style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic', margin: 0 }}>Selecciona una fecha primero</p>
                  ) : loadingEmpleados ? (
                    <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>Cargando técnicos...</p>
                  ) : (
                    <select className="form-control" value={citaForm.Id_Empleado} onChange={e => setCitaForm(p => ({ ...p, Id_Empleado: e.target.value }))}>
                      <option value="">Sin preferencia</option>
                      {empleadosDisponibles.map(e => (
                        <option key={e.id_empleado} value={e.id_empleado} disabled={!e.disponible} style={!e.disponible ? { color: '#888' } : {}}>
                          {e.Nombre}{!e.disponible ? ' (No disponible)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '0.25rem' }}>Descripción</label>
                  <textarea className="form-control" value={citaForm.Descripcion} rows={3} maxLength={300}
                    onChange={e => setCitaForm(p => ({ ...p, Descripcion: e.target.value }))}
                    placeholder="Describe brevemente el motivo de la cita..." />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="portal-btn" onClick={() => { setShowCitaModal(false); setEmpleadosDisponibles([]); }}>Cancelar</button>
                  <button type="submit" className="portal-btn portal-btn--primary" disabled={citaLoading}>
                    {citaLoading ? 'Guardando...' : 'Agendar cita'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── ORDER DETAIL MODAL ──────────────────────────── */}
      {(detailOrden || loadingOrden) && (
        <div className="portal-modal-overlay" onClick={() => { setDetailOrden(null); }}>
          <div className="portal-modal portal-modal--lg" onClick={e => e.stopPropagation()}>
            <div className="portal-modal__header">
              <h3>Detalle de la orden {detailOrden ? `#${detailOrden.Id_Orden}` : ''}</h3>
              <button className="portal-modal__close" onClick={() => setDetailOrden(null)}><MdClose size={18} /></button>
            </div>
            <div className="portal-modal__body">
              {loadingOrden && !detailOrden ? (
                <div className="portal-loading">Cargando detalle...</div>
              ) : detailOrden ? (
                <div>
                  <div className="portal-detail-grid" style={{ marginBottom: '1.5rem' }}>
                    {[['Número', `#${detailOrden.Id_Orden}`],
                      ['Estado', '—'],
                      ['Vehículo', detailOrden.Vehiculo || `#${detailOrden.Id_Vehiculo}`],
                      ['Diagnóstico', detailOrden.Diagnostico || '—'],
                      ['Kilometraje', detailOrden.Kilometraje ? `${detailOrden.Kilometraje.toLocaleString()} km` : '—'],
                      ['Fecha ingreso', fmtDate(detailOrden.FechaIngreso)],
                      ['Fecha entrega', fmtDate(detailOrden.FechaEntrega)],
                    ].map(([l, v], i) => (
                      <div key={l} className="portal-detail-item">
                        <span className="portal-detail-label">{l}</span>
                        {i === 1
                          ? <StateBadge estado={detailOrden.Estado} />
                          : <span className="portal-detail-value">{v}</span>
                        }
                      </div>
                    ))}
                  </div>

                  {detailOrden.servicios?.length > 0 && (
                    <div className="portal-order-section">
                      <h4 className="portal-order-section__title">Servicios</h4>
                      <table className="portal-order-table">
                        <thead><tr><th>Servicio</th><th>Precio unitario</th></tr></thead>
                        <tbody>
                          {detailOrden.servicios.map((s, i) => (
                            <tr key={i}>
                              <td>{s.servicio || s.Nombre || `Servicio #${s.Id_Servicio}`}</td>
                              <td>{fmtCurrency(s.precio_unitario)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {detailOrden.repuestos?.length > 0 && (
                    <div className="portal-order-section">
                      <h4 className="portal-order-section__title">Repuestos utilizados</h4>
                      <table className="portal-order-table">
                        <thead><tr><th>Repuesto</th><th>Cantidad</th><th>Precio unit.</th><th>Subtotal</th></tr></thead>
                        <tbody>
                          {detailOrden.repuestos.map((r, i) => (
                            <tr key={i}>
                              <td>{r.repuesto || r.Nombre || `Repuesto #${r.Id_Repuesto}`}</td>
                              <td>{r.cantidad}</td>
                              <td>{fmtCurrency(r.precio_unitario)}</td>
                              <td>{fmtCurrency(Number(r.cantidad || 0) * Number(r.precio_unitario || 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {detailOrden.mano_de_obra != null && (
                    <div className="portal-order-total-row">
                      <span>Mano de obra</span>
                      <span>{fmtCurrency(detailOrden.mano_de_obra)}</span>
                    </div>
                  )}

                  <div className="portal-order-grand-total">
                    <span>Total estimado</span>
                    <span>
                      {fmtCurrency(
                        (detailOrden.servicios || []).reduce((s, x) => s + Number(x.precio_unitario || 0), 0) +
                        (detailOrden.repuestos || []).reduce((s, x) => s + Number(x.cantidad || 0) * Number(x.precio_unitario || 0), 0) +
                        Number(detailOrden.mano_de_obra || 0)
                      )}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
