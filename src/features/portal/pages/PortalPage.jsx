import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../shared/services/api.js';
import './PortalPage.css';

const PORTAL_KEY = 'sigot_portal_token';
const PORTAL_CLIENT_KEY = 'sigot_portal_cliente';

/* ── helpers ─────────────────────────────────────────────── */
const fmtCurrency = v => v != null ? `$${Number(v).toLocaleString('es-CO')}` : '—';
const fmtDate = v => {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return v; }
};

const STATE_BADGE = {
  1: { label: 'Activa', cls: 'badge--success' },
  0: { label: 'Completada', cls: 'badge--green' },
  2: { label: 'Pendiente', cls: 'badge--yellow' },
  3: { label: 'En proceso', cls: 'badge--blue' },
  4: { label: 'Cancelada', cls: 'badge--red' },
};

function StateBadge({ estado }) {
  const info = STATE_BADGE[estado] || { label: `Estado ${estado}`, cls: 'badge--gray' };
  return <span className={`portal-badge ${info.cls}`}>{info.label}</span>;
}

/* ── Login panel ─────────────────────────────────────────── */
function PortalLogin({ onLogin }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ Correo: '', Documento: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fillDemo = (correo, doc) => setForm({ Correo: correo, Documento: doc });

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.Correo || !form.Documento) { setError('Ingresa tu correo y número de documento.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/auth/cliente-login', { Correo: form.Correo });
      const { token, cliente } = res.data?.data || {};
      localStorage.setItem(PORTAL_KEY, token);
      localStorage.setItem(PORTAL_CLIENT_KEY, JSON.stringify(cliente));
      onLogin(cliente, token);
    } catch (err) {
      setError(err?.response?.data?.message || 'Credenciales inválidas');
    } finally { setLoading(false); }
  };

  return (
    <div className="portal-login-wrap">
      <div className="portal-login-blobs">
        <div className="portal-blob portal-blob--1" />
        <div className="portal-blob portal-blob--2" />
      </div>

      <div className="portal-login-card">
        <div className="portal-login-logo">
          <div className="portal-login-logo__icon">S</div>
          <div>
            <h1 className="portal-login-logo__title">SIGOT</h1>
            <p className="portal-login-logo__sub">Portal del Cliente</p>
          </div>
        </div>

        {error && <div className="portal-error">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="portal-form-group">
            <label>Correo electrónico</label>
            <input
              type="email" value={form.Correo} placeholder="tu@correo.com"
              onChange={e => { setForm(p => ({ ...p, Correo: e.target.value })); setError(''); }}
              required
            />
          </div>
          <div className="portal-form-group">
            <label>Número de documento</label>
            <input
              type="text" value={form.Documento} placeholder="Ej: 1234567890"
              onChange={e => { setForm(p => ({ ...p, Documento: e.target.value })); setError(''); }}
              required
            />
          </div>
          <button type="submit" className="portal-btn portal-btn--primary portal-btn--full" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="portal-demo">
          <p className="portal-demo__title">Acceso rápido demo</p>
          <div className="portal-demo__grid">
            {[
              { label: 'Cliente Demo', correo: 'cliente@sigot.com', doc: '1234567890' },
            ].map(d => (
              <button key={d.correo} className="portal-demo__btn" type="button" onClick={() => fillDemo(d.correo, d.doc)}>
                <span className="portal-demo__name">{d.label}</span>
                <span className="portal-demo__cred">{d.correo}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="portal-login-footer">
          <button className="portal-link" onClick={() => navigate('/')}>← Volver al inicio</button>
          <button className="portal-link" onClick={() => navigate('/login')}>Soy empleado →</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main portal ─────────────────────────────────────────── */
export default function PortalPage() {
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [token, setToken] = useState(null);
  const [tab, setTab] = useState('cuenta'); // cuenta | vehiculos | ordenes
  const [vehiculos, setVehiculos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(false);
  // Evita redirigir antes de que el useEffect lea el localStorage
  const [initialized, setInitialized] = useState(false);

  // Account edit state
  const [editData, setEditData] = useState({});
  const [fotoPreview, setFotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const fileRef = useRef(null);

  // Vehicle detail modal
  const [detailVeh, setDetailVeh] = useState(null);
  // Order detail modal
  const [detailOrden, setDetailOrden] = useState(null);
  const [loadingOrden, setLoadingOrden] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem(PORTAL_KEY);
    const storedCliente = localStorage.getItem(PORTAL_CLIENT_KEY);
    if (storedToken && storedCliente) {
      const c = JSON.parse(storedCliente);
      setCliente(c);
      setToken(storedToken);
      setEditData({ Correo: c.Correo || '', Telefono: c.Telefono || '', Direccion: c.Direccion || '' });
      setFotoPreview(c.Foto || null);
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!cliente || !token) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      api.get('/api/portal/vehiculos', { headers }),
      api.get('/api/portal/ordenes', { headers }),
    ]).then(([vRes, oRes]) => {
      setVehiculos(vRes.data?.data || []);
      setOrdenes(oRes.data?.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [cliente, token]);

  const handleLogin = (c, t) => {
    setCliente(c);
    setToken(t);
    setEditData({ Correo: c.Correo || '', Telefono: c.Telefono || '', Direccion: c.Direccion || '' });
    setFotoPreview(c.Foto || null);
  };

  const handleLogout = () => {
    localStorage.removeItem(PORTAL_KEY);
    localStorage.removeItem(PORTAL_CLIENT_KEY);
    setCliente(null);
    setToken(null);
  };

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
      await api.put('/api/portal/perfil', {
        Correo:   editData.Correo,
        Contacto: editData.Telefono,
      }, { headers: { Authorization: `Bearer ${token}` } });
      const updated = { ...cliente, ...editData, Foto: fotoPreview };
      setCliente(updated);
      localStorage.setItem(PORTAL_CLIENT_KEY, JSON.stringify(updated));
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch {
      // silently fail demo
    } finally { setSaving(false); }
  };

  const openOrden = async (orden) => {
    setDetailOrden(null);
    setLoadingOrden(true);
    try {
      const r = await api.get(`/api/portal/ordenes/${orden.Id_Orden}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDetailOrden(r.data?.data || orden);
    } catch { setDetailOrden(orden); }
    finally { setLoadingOrden(false); }
  };

  // Espera a que el useEffect lea localStorage antes de decidir
  if (!initialized) return null;
  // Sin sesión → muestra el formulario de login del portal
  if (!cliente) return <PortalLogin onLogin={handleLogin} />;

  const BRAND_COLORS = ['#16a34a','#2563eb','#9333ea','#ea580c','#0891b2'];
  const brandColor = (name) => BRAND_COLORS[name?.charCodeAt(0) % BRAND_COLORS.length] || '#16a34a';

  return (
    <div className="portal">
      {/* Header */}
      <header className="portal-header">
        <div className="portal-header__inner">
          <div className="portal-header__brand" onClick={() => navigate('/')} style={{cursor:'pointer'}}>
            <div className="portal-header__logo">S</div>
            <div>
              <span className="portal-header__name">SIGOT</span>
              <span className="portal-header__sub">Portal del Cliente</span>
            </div>
          </div>
          <nav className="portal-header__nav">
            {[['cuenta','Mi Cuenta'],['vehiculos','Mis Vehículos'],['ordenes','Mis Órdenes']].map(([k,l]) => (
              <button key={k} className={`portal-tab${tab===k?' portal-tab--active':''}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </nav>
          <div className="portal-header__user">
            {fotoPreview
              ? <img src={fotoPreview} alt="" className="portal-header__avatar" />
              : <div className="portal-header__avatar portal-header__avatar--init">{cliente.Nombre?.charAt(0)}</div>
            }
            <span className="portal-header__username">{cliente.Nombre?.split(' ')[0]}</span>
            <button className="portal-header__logout" onClick={handleLogout}>Salir</button>
          </div>
        </div>
      </header>

      <main className="portal-main">

        {/* ── MI CUENTA ────────────────────────────────────── */}
        {tab === 'cuenta' && (
          <div className="portal-section">
            <div className="portal-section__header">
              <h2>Mi Cuenta</h2>
              <p>Gestiona tu información personal</p>
            </div>

            <div className="portal-account-grid">
              {/* Avatar */}
              <div className="portal-avatar-card">
                <div className="portal-avatar-wrap">
                  {fotoPreview
                    ? <img src={fotoPreview} alt="avatar" className="portal-avatar-img" />
                    : <div className="portal-avatar-placeholder">{cliente.Nombre?.charAt(0)}</div>
                  }
                  <button className="portal-avatar-btn" onClick={() => fileRef.current?.click()}>
                    📷 Cambiar foto
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFotoChange} />
                </div>
                <div className="portal-avatar-name">{cliente.Nombre}</div>
                <div className="portal-avatar-doc">{cliente.TipoDocumento} · {cliente.Documento}</div>
              </div>

              {/* Form */}
              <form className="portal-account-form" onSubmit={handleSave}>
                {saveOk && <div className="portal-success">✓ Datos actualizados correctamente</div>}

                <div className="portal-form-section-title">Datos de solo lectura</div>
                <div className="portal-readonly-grid">
                  {[
                    ['Nombre completo', cliente.Nombre],
                    ['Tipo de documento', cliente.TipoDocumento],
                    ['Número de documento', cliente.Documento],
                    ['Fecha de registro', fmtDate(cliente.FechaRegistro || cliente.createdAt)],
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
                    <input value={editData.Correo} onChange={e => setEditData(p => ({...p, Correo: e.target.value}))} type="email" />
                  </div>
                  <div className="portal-form-group">
                    <label>Teléfono</label>
                    <input value={editData.Telefono} onChange={e => setEditData(p => ({...p, Telefono: e.target.value}))} />
                  </div>
                  <div className="portal-form-group portal-form-group--full">
                    <label>Dirección</label>
                    <input value={editData.Direccion} onChange={e => setEditData(p => ({...p, Direccion: e.target.value}))} />
                  </div>
                </div>

                <button type="submit" className="portal-btn portal-btn--primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── MIS VEHÍCULOS ─────────────────────────────────── */}
        {tab === 'vehiculos' && (
          <div className="portal-section">
            <div className="portal-section__header">
              <h2>Mis Vehículos</h2>
              <p>{vehiculos.length} vehículo(s) registrado(s)</p>
            </div>
            {loading ? <div className="portal-loading">Cargando...</div> : (
              vehiculos.length === 0 ? (
                <div className="portal-empty">No tienes vehículos registrados aún.</div>
              ) : (
                <div className="portal-vehicles-grid">
                  {vehiculos.map(v => (
                    <div key={v.Id_Vehiculo} className="portal-vehicle-card">
                      <div className="portal-vehicle-card__icon" style={{ background: brandColor(v.Marca) }}>
                        🚗
                      </div>
                      <div className="portal-vehicle-card__info">
                        <h3 className="portal-vehicle-card__name">{v.Marca} {v.Modelo}</h3>
                        <div className="portal-vehicle-card__placa">{v.Placa}</div>
                        <div className="portal-vehicle-card__meta">
                          <span>📅 {v.Anio}</span>
                          {v.Color && <span>🎨 {v.Color}</span>}
                        </div>
                      </div>
                      <div className="portal-vehicle-card__actions">
                        <button className="portal-btn portal-btn--outline portal-btn--sm" onClick={() => setDetailVeh(v)}>
                          Ver detalles
                        </button>
                        <button className="portal-btn portal-btn--ghost portal-btn--sm"
                          onClick={() => { setTab('ordenes'); }}>
                          Mis órdenes
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* ── MIS ÓRDENES ───────────────────────────────────── */}
        {tab === 'ordenes' && (
          <div className="portal-section">
            <div className="portal-section__header">
              <h2>Mis Órdenes de Trabajo</h2>
              <p>{ordenes.length} orden(es) registrada(s)</p>
            </div>
            {loading ? <div className="portal-loading">Cargando...</div> : (
              ordenes.length === 0 ? (
                <div className="portal-empty">No tienes órdenes registradas aún.</div>
              ) : (
                <div className="portal-orders-list">
                  {ordenes.map(o => {
                    const veh = vehiculos.find(v => v.Id_Vehiculo == o.Id_Vehiculo);
                    return (
                      <div key={o.Id_Orden} className="portal-order-card" onClick={() => openOrden(o)}>
                        <div className="portal-order-card__top">
                          <div className="portal-order-card__num">Orden #{o.Id_Orden}</div>
                          <StateBadge estado={o.Estado} />
                        </div>
                        <div className="portal-order-card__vehicle">
                          🚗 {veh ? `${veh.Marca} ${veh.Modelo} · ${veh.Placa}` : o.Vehiculo || `Vehículo #${o.Id_Vehiculo}`}
                        </div>
                        <div className="portal-order-card__dates">
                          <span>📅 Ingreso: {fmtDate(o.FechaIngreso)}</span>
                          {o.FechaEntrega && <span>🏁 Entrega: {fmtDate(o.FechaEntrega)}</span>}
                        </div>
                        <div className="portal-order-card__cta">Ver detalle completo →</div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        )}
      </main>

      {/* ── VEHICLE DETAIL MODAL ──────────────────────────── */}
      {detailVeh && (
        <div className="portal-modal-overlay" onClick={() => setDetailVeh(null)}>
          <div className="portal-modal" onClick={e => e.stopPropagation()}>
            <div className="portal-modal__header">
              <h3>Detalle del vehículo</h3>
              <button className="portal-modal__close" onClick={() => setDetailVeh(null)}>✕</button>
            </div>
            <div className="portal-modal__body">
              <div className="portal-detail-grid">
                {[['Placa', detailVeh.Placa],['VIN', detailVeh.VIN||'—'],['Marca', detailVeh.Marca],
                  ['Modelo', detailVeh.Modelo],['Año', detailVeh.Anio],['Color', detailVeh.Color||'—'],
                  ['Estado', detailVeh.Estado === 1 ? 'Activo' : 'Inactivo']].map(([l,v]) => (
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

      {/* ── ORDER DETAIL MODAL ───────────────────────────── */}
      {(detailOrden || loadingOrden) && (
        <div className="portal-modal-overlay" onClick={() => { setDetailOrden(null); }}>
          <div className="portal-modal portal-modal--lg" onClick={e => e.stopPropagation()}>
            <div className="portal-modal__header">
              <h3>Detalle de la orden {detailOrden ? `#${detailOrden.Id_Orden}` : ''}</h3>
              <button className="portal-modal__close" onClick={() => setDetailOrden(null)}>✕</button>
            </div>
            <div className="portal-modal__body">
              {loadingOrden && !detailOrden ? (
                <div className="portal-loading">Cargando detalle...</div>
              ) : detailOrden ? (
                <div>
                  <div className="portal-detail-grid" style={{marginBottom:'1.5rem'}}>
                    {[['Número', `#${detailOrden.Id_Orden}`],
                      ['Estado', '—'],
                      ['Vehículo', detailOrden.Vehiculo || `#${detailOrden.Id_Vehiculo}`],
                      ['Diagnóstico', detailOrden.Diagnostico || '—'],
                      ['Kilometraje', detailOrden.Kilometraje ? `${detailOrden.Kilometraje.toLocaleString()} km` : '—'],
                      ['Fecha ingreso', fmtDate(detailOrden.FechaIngreso)],
                      ['Fecha entrega', fmtDate(detailOrden.FechaEntrega)],
                    ].map(([l,v], i) => (
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
                              <td>{s.Nombre || `Servicio #${s.Id_Servicio}`}</td>
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
                              <td>{r.Nombre || `Repuesto #${r.Id_Repuesto}`}</td>
                              <td>{r.cantidad}</td>
                              <td>{fmtCurrency(r.precio_unitario)}</td>
                              <td>{fmtCurrency(Number(r.cantidad||0) * Number(r.precio_unitario||0))}</td>
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
                        (detailOrden.servicios || []).reduce((s, x) => s + Number(x.precio_unitario||0), 0) +
                        (detailOrden.repuestos || []).reduce((s, x) => s + Number(x.cantidad||0)*Number(x.precio_unitario||0), 0) +
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
