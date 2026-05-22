import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdEdit, MdSecurity, MdClose, MdPeople } from 'react-icons/md';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchRoles, createRol, updateRol, toggleRolEstado } from '../slices/rolesSlice.js';
import { permisosService } from '../../permisos/services/permisosService.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import Badge from '../../../shared/components/Badge/Badge.jsx';
import { filterItems } from '../../../shared/utils/helpers.js';
import api from '../../../shared/services/api.js';
import './RolesPage.css';

const PRIMARY_ROLES = [
  { nombre: 'Administrador', color: 'success' },
  { nombre: 'Secretario',    color: 'info'    },
  { nombre: 'Bodeguero',     color: 'warning' },
  { nombre: 'Técnico',       color: 'danger'  },
];
const matchRol = (a, b) => a?.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;
const isPrimaryRol = (nombre) => PRIMARY_ROLES.some(pr => matchRol(pr.nombre, nombre));
const ROLE_COLORS = ['success', 'info', 'warning', 'danger', 'default'];
const MODULOS = ['Clientes', 'Vehículos', 'Empleados', 'Repuestos', 'Proveedores', 'Compras', 'Servicios', 'Agenda', 'Órdenes', 'Novedades', 'Roles'];

const emptyAccesos = () => {
  const a = {};
  MODULOS.forEach(m => { a[m] = 0; });
  return a;
};

export default function RolesPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.roles);
  const [empleados, setEmpleados] = useState([]);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize]         = useState(5);

  // Create modal
  const [showCreate, setShowCreate]   = useState(false);
  const [createNombre, setCreateNombre] = useState('');
  const [createError, setCreateError]   = useState('');

  // Inline edit panel
  const [showEdit, setShowEdit]       = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [formNombre, setFormNombre]   = useState('');
  const [formAccesos, setFormAccesos] = useState(emptyAccesos());
  const [permsLoading, setPermsLoading] = useState(false);
  const [formError, setFormError]     = useState('');
  const [saving, setSaving]           = useState(false);

  const ensuredRef = useRef(false);

  const ensurePrimaryRoles = async (fetchedItems) => {
    let changed = false;
    for (const pr of PRIMARY_ROLES) {
      const found = fetchedItems.find(i => matchRol(i.Nombre, pr.nombre));
      if (!found) {
        await dispatch(createRol({ Nombre: pr.nombre }));
        changed = true;
      } else if (found.Estado === 0 && found.Id_Rol !== 1) {
        await dispatch(toggleRolEstado(found.Id_Rol));
        changed = true;
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
    return statusFilter === 'activos' ? after.filter(r => r.Estado === 1)
      : statusFilter === 'inactivos' ? after.filter(r => r.Estado === 0) : after;
  })();

  const sortedForTable = (() => {
    const primaries = filteredForTable.filter(r => isPrimaryRol(r.Nombre));
    const others    = filteredForTable.filter(r => !isPrimaryRol(r.Nombre));
    if (others.length === 0) return primaries;
    return [...primaries, { _separator: true, _label: 'Roles secundarios', Id_Rol: '_sep' }, ...others];
  })();

  const openCreate = () => { setCreateNombre(''); setCreateError(''); setShowCreate(true); };

  const openEdit = async (rol) => {
    if (rol.Id_Rol === 1) return;
    setEditingId(rol.Id_Rol);
    setFormNombre(rol.Nombre);
    setFormError('');
    setFormAccesos(emptyAccesos());
    setShowEdit(true);
    setPermsLoading(true);
    try {
      const r = await api.get(`/api/permisos/rol/${rol.Id_Rol}`);
      const list = r.data?.data || r.data || [];
      const accesos = emptyAccesos();
      list.forEach(p => {
        if (accesos.hasOwnProperty(p.Modulo)) {
          accesos[p.Modulo] = (p.Ver || p.Crear || p.Editar || p.Eliminar || p['Cambiar estado']) ? 1 : 0;
        }
      });
      setFormAccesos(accesos);
    } catch { } finally { setPermsLoading(false); }
  };

  const toggleAcceso = (mod) => {
    setFormAccesos(prev => ({ ...prev, [mod]: prev[mod] ? 0 : 1 }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createNombre.trim()) { setCreateError('El nombre es obligatorio.'); return; }
    const result = await dispatch(createRol({ Nombre: createNombre.trim() }));
    if (!result.error) { setShowCreate(false); dispatch(fetchRoles()); }
    else setCreateError(result.payload || 'Error al guardar.');
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!formNombre.trim()) { setFormError('El nombre es obligatorio.'); return; }
    setSaving(true);
    try {
      await dispatch(updateRol({ id: editingId, data: { Nombre: formNombre.trim() } }));
      const permsArray = MODULOS.map(mod => ({
        Modulo: mod,
        Ver: formAccesos[mod],
        Crear: formAccesos[mod],
        Editar: formAccesos[mod],
        Eliminar: formAccesos[mod],
      }));
      await permisosService.saveByRol(editingId, permsArray);
      setShowEdit(false);
      dispatch(fetchRoles());
    } catch { setFormError('Error al guardar los cambios.'); } finally { setSaving(false); }
  };

  const handleToggle = (rol) => {
    if (rol.Id_Rol === 1) return;
    dispatch(toggleRolEstado(rol.Id_Rol));
  };

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
          {row.Id_Rol === 1 && <Badge variant="success" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>Sistema</Badge>}
        </div>
      )
    },
    {
      key: 'Estado', label: 'Estado', render: (_, row) =>
        row.Id_Rol === 1
          ? <Badge variant="success">Activo</Badge>
          : <Badge variant={row.Estado === 1 ? 'success' : 'gray'}>{row.Estado === 1 ? 'Activo' : 'Inactivo'}</Badge>
    },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          {row.Id_Rol !== 1 && (
            <>
              <button className="btn btn--ghost btn--icon btn--sm" title="Editar permisos" onClick={() => openEdit(row)}>
                <MdEdit size={17} />
              </button>
              <ToggleSwitch
                checked={row.Estado === 1}
                onChange={() => handleToggle(row)}
              />
            </>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Roles</h1>
          <p className="page__subtitle">{items.length} rol(es) configurado(s)</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}><MdAdd size={18} />Nuevo rol</button>
      </div>

      {/* Primary role cards */}
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

      {/* Split layout */}
      <div className={`roles-split${showEdit ? ' roles-split--active' : ''}`}>
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
          <Table columns={columns} data={sortedForTable} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron roles" />
        </div>

        {/* Edit panel â€" module toggle list */}
        {showEdit && (
          <div className="card roles-split__panel">
            <div className="roles-panel-header">
              <h3 className="roles-panel-title">Editar rol</h3>
              <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setShowEdit(false)}><MdClose size={18} /></button>
            </div>
            <div className="roles-panel-body">
              {formError && <div className="form-error-box" style={{ marginBottom: '1rem' }}>{formError}</div>}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Nombre del rol <span className="required">*</span></label>
                <input className="form-control" value={formNombre} onChange={e => setFormNombre(e.target.value)} placeholder="Nombre del rol" />
              </div>
              <p className="form-label" style={{ marginBottom: '0.75rem' }}>Acceso por módulo</p>
              {permsLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Cargando...</div>
              ) : (
                <div className="modulos-list">
                  {MODULOS.map(mod => (
                    <div key={mod} className="modulo-row">
                      <span className="modulo-row__name">{mod}</span>
                      <ToggleSwitch
                        checked={!!formAccesos[mod]}
                        onChange={() => toggleAcceso(mod)}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="roles-panel-footer">
                <button className="btn btn--outline" onClick={() => setShowEdit(false)}>Cancelar</button>
                <button className="btn btn--primary" onClick={handleEditSave} disabled={saving || permsLoading}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
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
    </div>
  );
}

