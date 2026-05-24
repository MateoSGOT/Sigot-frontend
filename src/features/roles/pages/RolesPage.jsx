import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import {
  MdAdd, MdEdit, MdSave, MdCheck, MdClose, MdPeople, MdSecurity,
  MdDashboard, MdPeopleAlt, MdDirectionsCar, MdBuild, MdCategory,
  MdLocalShipping, MdShoppingCart, MdMiscellaneousServices,
  MdEventNote, MdAssignment, MdNewReleases, MdPerson,
} from 'react-icons/md';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchRoles, createRol, updateRol, toggleRolEstado } from '../slices/rolesSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import Badge from '../../../shared/components/Badge/Badge.jsx';
import { filterItems } from '../../../shared/utils/helpers.js';
import api from '../../../shared/services/api.js';
import './RolesPage.css';

/* ── Constants ─────────────────────────────────────────────────── */

const PRIMARY_ROLES = [
  { nombre: 'Administrador', color: 'success' },
  { nombre: 'Secretario',    color: 'info'    },
  { nombre: 'Bodeguero',     color: 'warning' },
  { nombre: 'Técnico',  color: 'danger'  }, // Técnico — explicit Unicode escape to avoid encoding issues
];

const ROLE_COLORS = ['success', 'info', 'warning', 'danger', 'default'];

const matchRol     = (a, b) => a?.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;
const isPrimaryRol = (nombre) => PRIMARY_ROLES.some(pr => matchRol(pr.nombre, nombre));

const ACTIONS = ['Ver', 'Crear', 'Editar', 'Eliminar'];

const MODULE_META = {
  'Dashboard':   { icon: MdDashboard,             label: 'Dashboard',          color: '#6366f1' },
  'Clientes':    { icon: MdPerson,                label: 'Clientes',           color: '#0ea5e9' },
  'Vehículos':{ icon: MdDirectionsCar,         label: 'Vehículos',     color: '#14b8a6' },
  'Empleados':   { icon: MdPeopleAlt,             label: 'Empleados',          color: '#8b5cf6' },
  'Repuestos':   { icon: MdBuild,                 label: 'Repuestos',          color: '#f59e0b' },
  'Categorías': { icon: MdCategory,          label: 'Categorías',    color: '#10b981' },
  'Proveedores': { icon: MdLocalShipping,         label: 'Proveedores',        color: '#f97316' },
  'Compras':     { icon: MdShoppingCart,          label: 'Compras',            color: '#ef4444' },
  'Servicios':   { icon: MdMiscellaneousServices, label: 'Servicios',          color: '#a855f7' },
  'Agenda':      { icon: MdEventNote,             label: 'Agenda',             color: '#22c55e' },
  'Órdenes':{ icon: MdAssignment,            label: 'Órdenes de Trabajo', color: '#eab308' },
  'Novedades':   { icon: MdNewReleases,           label: 'Novedades',          color: '#ec4899' },
  'Roles':       { icon: MdSecurity,              label: 'Roles',              color: '#b5f23d' },
};

const MODULES_ORDER = [
  'Dashboard', 'Clientes', 'Vehículos', 'Empleados', 'Repuestos',
  'Categorías', 'Proveedores', 'Compras', 'Servicios', 'Agenda',
  'Órdenes', 'Novedades', 'Roles',
];

const emptyMatrix = () =>
  MODULES_ORDER.map(mod => ({ Modulo: mod, Ver: 0, Crear: 0, Editar: 0, Eliminar: 0 }));

/* ── Component ─────────────────────────────────────────────────── */

export default function RolesPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.roles);
  const puedeCrear   = usePermiso('ROLES.REGISTRAR');
  const puedeEditar  = usePermiso('ROLES.EDITAR');
  const puedeToggle  = usePermiso('ROLES.CAMBIAR_ESTADO');
  const [empleados, setEmpleados]       = useState([]);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize]         = useState(5);

  // Create modal
  const [showCreate, setShowCreate]       = useState(false);
  const [createNombre, setCreateNombre]   = useState('');
  const [createError, setCreateError]     = useState('');

  // Edit modal (RBAC matrix)
  const [showEdit, setShowEdit]     = useState(false);
  const [editingRol, setEditingRol] = useState(null);
  const [formNombre, setFormNombre] = useState('');
  const [matrix, setMatrix]         = useState([]);
  const [matLoading, setMatLoading] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');

  // Toast
  const [toast, setToast]   = useState(null);
  const toastTimer = useRef(null);
  const ensuredRef = useRef(false);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  /* Fix corrupted "TÃ©cnico"-style names that may exist in the DB */
  const fixEncoding = (nombre) => {
    try {
      return decodeURIComponent(escape(nombre));
    } catch {
      return nombre;
    }
  };

  const ensurePrimaryRoles = async (fetchedItems) => {
    let changed = false;
    for (const pr of PRIMARY_ROLES) {
      // Look for exact match OR mojibake variant (e.g. "TÃ©cnico" → "Técnico")
      const found = fetchedItems.find(i =>
        matchRol(i.Nombre, pr.nombre) || matchRol(fixEncoding(i.Nombre), pr.nombre)
      );
      if (!found) {
        await dispatch(createRol({ Nombre: pr.nombre }));
        changed = true;
      } else {
        if (found.Nombre !== pr.nombre) {
          // Fix corrupted/mojibake name stored in DB
          await dispatch(updateRol({ id: found.Id_Rol, data: { Nombre: pr.nombre } }));
          changed = true;
        }
        if (found.Estado === 0 && found.Id_Rol !== 1) {
          await dispatch(toggleRolEstado(found.Id_Rol));
          changed = true;
        }
      }
    }
    if (changed) dispatch(fetchRoles());
  };

  useEffect(() => {
    dispatch(fetchRoles()).then(action => {
      if (!action.error && !ensuredRef.current) {
        ensuredRef.current = true;
        ensurePrimaryRoles(Array.isArray(action.payload) ? action.payload : []);
      }
    });
    api.get('/api/empleados').then(r => setEmpleados(r.data?.data || r.data || [])).catch(() => {});
    return () => clearTimeout(toastTimer.current);
  }, [dispatch]);

  const getCount = (rolId) => empleados.filter(e => e.Id_Rol == rolId).length;

  const primaryCards = PRIMARY_ROLES.map(pr => {
    const found = items.find(i => matchRol(i.Nombre, pr.nombre));
    return { ...pr, item: found, count: found ? getCount(found.Id_Rol) : 0 };
  });
  const otrosRoles = items.filter(i => !isPrimaryRol(i.Nombre));
  const otrosCount = otrosRoles.reduce((sum, r) => sum + getCount(r.Id_Rol), 0);

  const filteredForTable = (() => {
    const after = filterItems(items, search, ['Nombre']);
    return statusFilter === 'activos'   ? after.filter(r => r.Estado === 1)
         : statusFilter === 'inactivos' ? after.filter(r => r.Estado === 0)
         : after;
  })();

  const sortedForTable = (() => {
    const primaries = filteredForTable.filter(r => isPrimaryRol(r.Nombre));
    const others    = filteredForTable.filter(r => !isPrimaryRol(r.Nombre));
    if (others.length === 0) return primaries;
    return [
      ...primaries,
      { _separator: true, _label: 'Roles secundarios', Id_Rol: '_sep' },
      ...others,
    ];
  })();

  /* ── Handlers ── */

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
    dispatch(toggleRolEstado(rol.Id_Rol));
  };

  /* ── Table columns ── */

  const columns = [
    {
      key: 'Nombre',
      label: 'Rol',
      render: (v, row, i) => (
        <div className="role-name-cell">
          <div className={`role-icon role-icon--${ROLE_COLORS[i % ROLE_COLORS.length]}`}>
            <MdSecurity size={15} />
          </div>
          <span className="font-medium">{v}</span>
          {row.Id_Rol === 1 && (
            <Badge variant="success" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>Sistema</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'Estado',
      label: 'Estado',
      render: (_, row) =>
        row.Id_Rol === 1
          ? <Badge variant="success">Activo</Badge>
          : <Badge variant={row.Estado === 1 ? 'success' : 'gray'}>{row.Estado === 1 ? 'Activo' : 'Inactivo'}</Badge>,
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_, row) => (
        <div className="table-actions">
          {row.Id_Rol !== 1 && (
            <>
              <button
                className="btn btn--ghost btn--icon btn--sm"
                title="Editar permisos"
                disabled={!puedeEditar}
                onClick={() => openEdit(row)}
              >
                <MdEdit size={17} />
              </button>
              <ToggleSwitch checked={row.Estado === 1} onChange={() => handleToggle(row)} disabled={!puedeToggle} />
            </>
          )}
        </div>
      ),
    },
  ];

  /* ── Render ── */

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Roles</h1>
          <p className="page__subtitle">{items.length} rol(es) configurado(s)</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}>
          <MdAdd size={18} /> Nuevo rol
        </button>
      </div>

      {/* ── Primary role summary cards ── */}
      <div className="roles-primary-cards">
        {primaryCards.map(card => (
          <div key={card.nombre} className={`roles-primary-card roles-primary-card--${card.color}`}>
            <div className={`roles-primary-icon role-icon--${card.color}`}>
              <MdSecurity size={22} />
            </div>
            <div className="roles-primary-info">
              <span className="roles-primary-name">{card.nombre}</span>
              <span className="roles-primary-count">
                <MdPeople size={13} style={{ marginRight: '3px' }} />
                {card.count} persona(s)
              </span>
            </div>
          </div>
        ))}
        {otrosRoles.length > 0 && (
          <div className="roles-primary-card roles-primary-card--default">
            <div className="roles-primary-icon role-icon--default">
              <MdSecurity size={22} />
            </div>
            <div className="roles-primary-info">
              <span className="roles-primary-name">Otros</span>
              <span className="roles-primary-count">
                <MdPeople size={13} style={{ marginRight: '3px' }} />
                {otrosCount} persona(s)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Roles table ── */}
      <div className="roles-split">
        <div className="card roles-split__table">
          <div className="card__header">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar rol..."
              filterSlot={
                <FilterDropdown
                  statusFilter={statusFilter}
                  onStatusChange={setStatusFilter}
                  pageSize={pageSize}
                  onPageSizeChange={setPageSize}
                />
              }
            />
          </div>
          <Table
            columns={columns}
            data={sortedForTable}
            loading={loading}
            pageSize={pageSize}
            emptyMessage="No se encontraron roles"
          />
        </div>
      </div>

      {/* ── Create modal ── */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo rol"
        size="sm"
        footer={
          <>
            <button className="btn btn--outline" onClick={() => setShowCreate(false)}>Cancelar</button>
            <button className="btn btn--primary" onClick={handleCreate} disabled={actionLoading}>
              {actionLoading ? 'Guardando...' : 'Crear'}
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

      {/* ── Edit modal — full RBAC matrix ── */}
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
                  const allOn  = ACTIONS.every(a => row[a] === 1);
                  const someOn = ACTIONS.some(a => row[a] === 1);
                  return (
                    <tr
                      key={row.Modulo}
                      className={`rol-mat-row${idx % 2 !== 0 ? ' rol-mat-row--alt' : ''}${someOn ? ' rol-mat-row--on' : ''}`}
                    >
                      <td className="rol-mat-td rol-mat-td--mod">
                        <div className="rol-mat-mod-cell">
                          {Icon && (
                            <span className="rol-mat-mod-icon" style={{ color: meta?.color || '#b5f23d' }}>
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
