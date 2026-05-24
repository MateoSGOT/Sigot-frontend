import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  MdAdd, MdEdit, MdSave, MdCheck, MdClose, MdPeople,
  MdSecurity, MdDashboard, MdPeopleAlt, MdDirectionsCar,
  MdBuild, MdCategory, MdLocalShipping, MdShoppingCart,
  MdMiscellaneousServices, MdEventNote, MdAssignment,
  MdNewReleases, MdPerson,
} from 'react-icons/md';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchRoles, createRol, updateRol, toggleRolEstado } from '../slices/rolesSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Badge from '../../../shared/components/Badge/Badge.jsx';
import { filterItems } from '../../../shared/utils/helpers.js';
import api from '../../../shared/services/api.js';
import './RolesPage.css';

const ACTIONS = ['Ver', 'Crear', 'Editar', 'Eliminar'];

const MODULE_META = {
  'Dashboard':   { icon: MdDashboard,             label: 'Dashboard',          color: '#6366f1' },
  'Clientes':    { icon: MdPerson,                label: 'Clientes',           color: '#0ea5e9' },
  'Vehículos':   { icon: MdDirectionsCar,         label: 'Vehículos',          color: '#14b8a6' },
  'Empleados':   { icon: MdPeopleAlt,             label: 'Empleados',          color: '#8b5cf6' },
  'Repuestos':   { icon: MdBuild,                 label: 'Repuestos',          color: '#f59e0b' },
  'Categorías':  { icon: MdCategory,              label: 'Categorías',         color: '#10b981' },
  'Proveedores': { icon: MdLocalShipping,         label: 'Proveedores',        color: '#f97316' },
  'Compras':     { icon: MdShoppingCart,          label: 'Compras',            color: '#ef4444' },
  'Servicios':   { icon: MdMiscellaneousServices, label: 'Servicios',          color: '#a855f7' },
  'Agenda':      { icon: MdEventNote,             label: 'Agenda',             color: '#22c55e' },
  'Órdenes':     { icon: MdAssignment,            label: 'Órdenes de Trabajo', color: '#eab308' },
  'Novedades':   { icon: MdNewReleases,           label: 'Novedades',          color: '#ec4899' },
  'Roles':       { icon: MdSecurity,              label: 'Roles',              color: '#b5f23d' },
};

const MODULES_ORDER = [
  'Dashboard','Clientes','Vehículos','Empleados','Repuestos',
  'Categorías','Proveedores','Compras','Servicios','Agenda',
  'Órdenes','Novedades','Roles',
];

const ROLE_PALETTE = [
  { bg: 'rgba(99,102,241,0.12)',  fg: '#6366f1' },
  { bg: 'rgba(14,165,233,0.12)',  fg: '#0ea5e9' },
  { bg: 'rgba(245,158,11,0.12)',  fg: '#f59e0b' },
  { bg: 'rgba(239,68,68,0.12)',   fg: '#ef4444' },
  { bg: 'rgba(168,85,247,0.12)',  fg: '#a855f7' },
  { bg: 'rgba(16,185,129,0.12)',  fg: '#10b981' },
  { bg: 'rgba(249,115,22,0.12)',  fg: '#f97316' },
];

const emptyMatrix = () =>
  MODULES_ORDER.map(mod => ({ Modulo: mod, Ver: 0, Crear: 0, Editar: 0, Eliminar: 0 }));

export default function RolesPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.roles);
  const [empleados, setEmpleados] = useState([]);
  const [search, setSearch] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createNombre, setCreateNombre] = useState('');
  const [createError, setCreateError] = useState('');

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editingRol, setEditingRol] = useState(null);
  const [formNombre, setFormNombre] = useState('');
  const [matrix, setMatrix] = useState([]);
  const [matLoading, setMatLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Toast
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    dispatch(fetchRoles());
    api.get('/api/empleados').then(r => setEmpleados(r.data?.data || r.data || [])).catch(() => {});
    return () => clearTimeout(toastTimer.current);
  }, [dispatch]);

  const getEmployeeCount = (rolId) => empleados.filter(e => e.Id_Rol == rolId).length;

  const openCreate = () => { setCreateNombre(''); setCreateError(''); setShowCreate(true); };

  const openEdit = async (rol) => {
    setEditingRol(rol);
    setFormNombre(rol.Nombre);
    setFormError('');
    setMatrix(emptyMatrix());
    setShowEdit(true);
    setMatLoading(true);
    try {
      const r = await api.get(`/api/permisos/rol/${rol.Id_Rol}`);
      const data = r.data?.data || r.data || [];
      setMatrix(emptyMatrix().map(row => {
        const found = data.find(d => d.Modulo === row.Modulo);
        return found ? { ...row, ...found } : row;
      }));
    } catch {} finally { setMatLoading(false); }
  };

  const toggleCell = (modulo, action) => {
    setMatrix(prev => prev.map(r =>
      r.Modulo === modulo ? { ...r, [action]: r[action] ? 0 : 1 } : r
    ));
  };

  const toggleRow = (modulo) => {
    const row = matrix.find(r => r.Modulo === modulo);
    if (!row) return;
    const allOn = ACTIONS.every(a => row[a] === 1);
    const val = allOn ? 0 : 1;
    setMatrix(prev => prev.map(r =>
      r.Modulo === modulo ? { ...r, Ver: val, Crear: val, Editar: val, Eliminar: val } : r
    ));
  };

  const toggleCol = (action) => {
    const allOn = matrix.every(r => r[action] === 1);
    setMatrix(prev => prev.map(r => ({ ...r, [action]: allOn ? 0 : 1 })));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createNombre.trim()) { setCreateError('El nombre es obligatorio.'); return; }
    const result = await dispatch(createRol({ Nombre: createNombre.trim() }));
    if (!result.error) {
      setShowCreate(false);
      dispatch(fetchRoles());
      showToast('success', `Rol "${createNombre.trim()}" creado`);
    } else {
      setCreateError(result.payload || 'Error al crear.');
    }
  };

  const handleEditSave = async () => {
    if (!formNombre.trim()) { setFormError('El nombre es obligatorio.'); return; }
    setSaving(true);
    try {
      await dispatch(updateRol({ id: editingRol.Id_Rol, data: { Nombre: formNombre.trim() } }));
      await api.put(`/api/permisos/rol/${editingRol.Id_Rol}`, matrix);
      setShowEdit(false);
      dispatch(fetchRoles());
      showToast('success', `Rol "${formNombre.trim()}" actualizado`);
    } catch {
      setFormError('Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (rol) => {
    if (rol.Id_Rol === 1) return;
    dispatch(toggleRolEstado(rol.Id_Rol)).then(() => dispatch(fetchRoles()));
  };

  const filtered = filterItems(items, search, ['Nombre']);

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Roles del sistema</h1>
          <p className="page__subtitle">Administra roles y sus permisos por módulo</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>
          <MdAdd size={18} /> Nuevo rol
        </button>
      </div>

      {/* Search */}
      <div className="roles-search-row">
        <input
          className="form-control roles-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar rol..."
        />
      </div>

      {/* Roles Grid */}
      <div className="roles-grid">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="role-card role-card--skel" />
          ))
        ) : filtered.length === 0 ? (
          <div className="roles-empty">No se encontraron roles</div>
        ) : (
          filtered.map((rol, idx) => {
            const palette = ROLE_PALETTE[idx % ROLE_PALETTE.length];
            const empCount = getEmployeeCount(rol.Id_Rol);
            const isSystem = rol.Id_Rol === 1;
            return (
              <div key={rol.Id_Rol} className="role-card">
                <div className="role-card__top">
                  <div className="role-card__icon" style={{ background: palette.bg, color: palette.fg }}>
                    <MdSecurity size={22} />
                  </div>
                  <div className="role-card__badges">
                    {isSystem && <Badge variant="info">Sistema</Badge>}
                    <Badge variant={rol.Estado === 1 ? 'success' : 'gray'}>
                      {rol.Estado === 1 ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>

                <div className="role-card__body">
                  <div className="role-card__name">{rol.Nombre}</div>
                  <div className="role-card__meta">
                    <MdPeople size={13} />
                    <span>{empCount} empleado{empCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="role-card__actions">
                  {!isSystem ? (
                    <>
                      <button
                        className="btn btn--ghost btn--sm role-card__edit-btn"
                        onClick={() => openEdit(rol)}
                      >
                        <MdEdit size={14} /> Editar permisos
                      </button>
                      <ToggleSwitch checked={rol.Estado === 1} onChange={() => handleToggle(rol)} />
                    </>
                  ) : (
                    <span className="role-card__system-note">Rol protegido del sistema</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Create Modal ── */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo rol"
        size="sm"
        footer={
          <>
            <button className="btn btn--outline" onClick={() => setShowCreate(false)}>Cancelar</button>
            <button className="btn btn--primary" onClick={handleCreate} disabled={actionLoading}>
              {actionLoading ? 'Creando...' : 'Crear rol'}
            </button>
          </>
        }
      >
        {createError && <div className="form-error-box">{createError}</div>}
        <div className="form-group">
          <label className="form-label">Nombre del rol <span className="required">*</span></label>
          <input
            className="form-control"
            value={createNombre}
            onChange={e => setCreateNombre(e.target.value)}
            placeholder="Ej: Recepcionista"
            onKeyDown={e => e.key === 'Enter' && handleCreate(e)}
            autoFocus
          />
        </div>
      </Modal>

      {/* ── Edit Modal — full RBAC matrix ── */}
      <Modal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title={`Editar rol — ${editingRol?.Nombre || ''}`}
        size="xl"
        footer={
          <>
            <button className="btn btn--outline" onClick={() => setShowEdit(false)}>Cancelar</button>
            <button
              className="btn btn--primary"
              onClick={handleEditSave}
              disabled={saving || matLoading}
            >
              {saving
                ? <><span className="rol-spinner" /> Guardando...</>
                : <><MdSave size={16} /> Guardar cambios</>
              }
            </button>
          </>
        }
      >
        {formError && <div className="form-error-box">{formError}</div>}

        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
          <label className="form-label">Nombre del rol <span className="required">*</span></label>
          <input
            className="form-control"
            style={{ maxWidth: 320 }}
            value={formNombre}
            onChange={e => setFormNombre(e.target.value)}
            placeholder="Nombre del rol"
          />
        </div>

        <div className="rol-section-divider" />
        <p className="rol-section-title">Permisos por módulo</p>
        <p className="rol-section-hint">
          Activa o desactiva permisos individuales. La columna "Todo" marca/desmarca toda la fila.
        </p>

        {matLoading ? (
          <div className="rol-mat-skeleton">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rol-skel-row" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="rol-skel-cell rol-skel-cell--mod" />
                {[0, 1, 2, 3, 4].map(j => (
                  <div key={j} className="rol-skel-cell rol-skel-cell--chk" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="rol-mat-wrap">
            <table className="rol-mat-table">
              <thead>
                <tr>
                  <th className="rol-mat-th rol-mat-th--mod">Módulo</th>
                  {ACTIONS.map(action => (
                    <th key={action} className="rol-mat-th rol-mat-th--act">
                      <div className="rol-mat-th-inner">
                        <span>{action}</span>
                        <input
                          type="checkbox"
                          className="rol-mat-chk"
                          title={`Seleccionar columna "${action}"`}
                          checked={matrix.length > 0 && matrix.every(r => r[action] === 1)}
                          onChange={() => toggleCol(action)}
                        />
                      </div>
                    </th>
                  ))}
                  <th className="rol-mat-th rol-mat-th--act">
                    <span className="rol-mat-th-todo">Todo</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, idx) => {
                  const meta = MODULE_META[row.Modulo];
                  const Icon = meta?.icon;
                  const allOn = ACTIONS.every(a => row[a] === 1);
                  const someOn = ACTIONS.some(a => row[a] === 1);
                  return (
                    <tr
                      key={row.Modulo}
                      className={`rol-mat-row${idx % 2 !== 0 ? ' rol-mat-row--alt' : ''}${someOn ? ' rol-mat-row--on' : ''}`}
                    >
                      <td className="rol-mat-td rol-mat-td--mod">
                        <div className="rol-mat-mod-cell">
                          {Icon && (
                            <span
                              className="rol-mat-mod-icon"
                              style={{ color: meta?.color || '#b5f23d' }}
                            >
                              <Icon size={15} />
                            </span>
                          )}
                          <span>{meta?.label || row.Modulo}</span>
                        </div>
                      </td>
                      {ACTIONS.map(action => (
                        <td key={action} className="rol-mat-td rol-mat-td--chk">
                          <input
                            type="checkbox"
                            className="rol-mat-chk"
                            checked={row[action] === 1}
                            onChange={() => toggleCell(row.Modulo, action)}
                          />
                        </td>
                      ))}
                      <td className="rol-mat-td rol-mat-td--chk">
                        <input
                          type="checkbox"
                          className="rol-mat-chk"
                          title="Marcar / desmarcar toda la fila"
                          checked={allOn}
                          onChange={() => toggleRow(row.Modulo)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* ── Toast ── */}
      {toast && (
        <div className={`rol-toast rol-toast--${toast.type}`}>
          {toast.type === 'success' ? <MdCheck size={17} /> : <MdClose size={17} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
