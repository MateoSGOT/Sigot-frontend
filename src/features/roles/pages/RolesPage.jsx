import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import {
  MdAdd, MdEdit, MdSave, MdCheck, MdClose, MdPeople, MdSecurity,
  MdDashboard, MdPeopleAlt, MdDirectionsCar, MdBuild, MdCategory,
  MdLocalShipping, MdShoppingCart, MdMiscellaneousServices,
  MdEventNote, MdAssignment, MdNewReleases, MdPerson, MdDeleteForever,
} from 'react-icons/md';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import EliminarRealModal from '../../../shared/components/EliminarRealModal/EliminarRealModal.jsx';
import { useBorradoReal } from '../../../shared/hooks/useBorradoReal.js';
import { rolesService } from '../services/rolesService.js';
import { fetchRoles, createRol, updateRol, toggleRolEstado } from '../slices/rolesSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import Badge from '../../../shared/components/Badge/Badge.jsx';
import { filterItems, sortNewestFirst } from '../../../shared/utils/helpers.js';
import * as V from '../../../shared/utils/validators.js';
import api from '../../../shared/services/api.js';

/* ── Constants ─────────────────────────────────────────────────── */

// "Administrador" ya NO es un rol especial (se gestiona como cualquier otro); el único
// rol fijado/protegido es el Súper Administrador (EsSistema), que se ancla arriba aparte.
const PRIMARY_ROLES = [
  { nombre: 'Secretario',    color: 'info'    },
  { nombre: 'Mecánico',      color: 'danger'  },
  { nombre: 'Bodeguero',     color: 'warning' },
];

const ROLE_COLORS = ['success', 'info', 'warning', 'danger', 'default'];

const matchRol     = (a, b) => a?.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;
const isPrimaryRol = (nombre) => PRIMARY_ROLES.some(pr => matchRol(pr.nombre, nombre));

const ACTIONS = ['Ver', 'Crear', 'Editar', 'Eliminar'];

const MODULE_META = {
  'Dashboard':   { icon: MdDashboard,             label: 'Dashboard',          color: '#6366F1' },
  'Clientes':    { icon: MdPerson,                label: 'Clientes',           color: '#0E7490' },
  'Vehículos':{ icon: MdDirectionsCar,         label: 'Vehículos',     color: '#14B8A6' },
  'Empleados':   { icon: MdPeopleAlt,             label: 'Empleados',          color: '#8B5CF6' },
  'Repuestos':   { icon: MdBuild,                 label: 'Repuestos',          color: '#F59E0B' },
  'Categorías': { icon: MdCategory,          label: 'Categorías',    color: '#14B8A6' },
  'Proveedores': { icon: MdLocalShipping,         label: 'Proveedores',        color: '#F59E0B' },
  'Compras':     { icon: MdShoppingCart,          label: 'Compras',            color: '#E11D48' },
  'Servicios':   { icon: MdMiscellaneousServices, label: 'Servicios',          color: '#8B5CF6' },
  'Agenda':      { icon: MdEventNote,             label: 'Agenda',             color: '#2B5CFF' },
  'Órdenes':{ icon: MdAssignment,            label: 'Órdenes de Trabajo', color: '#FBBF24' },
  'Novedades':   { icon: MdNewReleases,           label: 'Novedades',          color: '#8B5CF6' },
  'Roles':       { icon: MdSecurity,              label: 'Roles',              color: '#F59E0B' },
};

// 'Dashboard' es de solo lectura: no tiene Crear/Editar/Eliminar (esas columnas
// quedan deshabilitadas en su fila, ver el render de la tabla). Su "Ver" real son
// 4 permisos granulares (VER_FINANZAS, VER_STOCK, etc.) que el backend activa/
// desactiva juntos con un solo checkbox (permisos.controller.js).
const MODULES_ORDER = [
  'Dashboard',
  'Clientes', 'Vehículos', 'Empleados', 'Repuestos',
  'Categorías', 'Proveedores', 'Compras', 'Servicios', 'Agenda',
  'Órdenes', 'Novedades', 'Roles',
];

const emptyMatrix = () =>
  MODULES_ORDER.map(mod => ({ Modulo: mod, Ver: 0, Crear: 0, Editar: 0, Eliminar: 0 }));

/* ── Component ─────────────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════════════════════
   Clases del modulo de Roles, en utilidades.

   LOS DOS MAPAS SON OBLIGATORIOS, no una preferencia de estilo: las clases se
   construian como `role-icon--${color}` y `rol-toast--${type}`. Tailwind
   escanea TEXTO y no puede ver una clase armada en runtime: no generaria la
   utilidad y el color no se aplicaria, sin error ni warning.

   TRES CORRECCIONES DE ROL DE COLOR, que la auditoria de paleta no puede
   detectar porque los colores SI pertenecen al sistema -- lo que estaba mal
   era para que se usaban:
     · el hover de las filas de la matriz era ambar, y el ambar en este sistema
       significa "en proceso / requiere atencion". Un hover es ACCION: cobalto.
     · los checkboxes tenian accent-color ambar, por lo mismo.
     · el toast de exito tenia borde COBALTO sobre fondo esmeralda: familias
       cruzadas, el mismo defecto que ya se corrigio en los badges.
   ═══════════════════════════════════════════════════════════════════════════ */
const ROLE_ICON_COLOR = {
  success: 'bg-success-soft text-success-soft-on',
  info:    'bg-info-soft text-info-soft-on',
  warning: 'bg-warning-soft text-warning-soft-on',
  danger:  'bg-danger-soft text-danger-soft-on',
  default: 'bg-neutral-soft text-text-muted',
};

const TOAST_TIPO = {
  success: 'bg-success-soft text-success-soft-on border-success-soft-border',
  error:   'bg-danger-soft text-danger-soft-on border-danger-soft-border',
};

export default function RolesPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.roles);
  const puedeCrear   = usePermiso('ROLES.REGISTRAR');
  const puedeEditar  = usePermiso('ROLES.EDITAR');
  const puedeToggle  = usePermiso('ROLES.CAMBIAR_ESTADO');
  const esSuperadmin = useSelector(s => s.auth.empleado?.EsSuperAdmin === true);
  const del = useBorradoReal(rolesService, {
    entidadLabel: 'rol',
    onDeleted: () => { dispatch(fetchRoles()); api.get('/api/empleados').then(r => setEmpleados(r.data?.data || r.data || [])).catch(() => {}); },
  });
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
    // El Súper Administrador (rol de sistema) queda SIEMPRE fijado en la parte superior.
    const sistema   = filteredForTable.filter(r => r.EsSistema);
    const primaries = filteredForTable.filter(r => !r.EsSistema && isPrimaryRol(r.Nombre));
    const others    = sortNewestFirst(filteredForTable.filter(r => !r.EsSistema && !isPrimaryRol(r.Nombre)), 'Id_Rol');
    const head = [...sistema, ...primaries];
    if (others.length === 0) return head;
    return [
      ...head,
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
      // Pasa directo a gestionar sus permisos en vez de dejar el rol sin
      // ningún acceso hasta que alguien vuelva a entrar a editarlo.
      const nuevoRol = result.payload;
      if (nuevoRol?.Id_Rol) openEdit(nuevoRol);
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

  // Antes también protegía por nombre ('Administrador'), pero el backend nunca lo trató
  // como especial (solo Super Administrador vía EsSuperAdmin/EsSistema) -- "Administrador"
  // es un rol normal, editable y eliminable como cualquier otro.
  const isSistema = (row) => row.EsSistema;

  // Validación del nombre en tiempo real (mientras escribe, no solo al guardar).
  const createNombreError = createNombre ? V.nombre(createNombre, 2, 50) : '';
  const editNombreError   = formNombre  ? V.nombre(formNombre, 2, 50)   : '';

  const handleToggle = (rol) => {
    if (isSistema(rol)) return;
    dispatch(toggleRolEstado(rol.Id_Rol));
  };

  /* ── Table columns ── */

  const columns = [
    {
      key: 'Nombre',
      label: 'Rol',
      render: (v, row, i) => (
        <div className="flex items-center gap-md">
          <div className={`flex size-[30px] shrink-0 items-center justify-center rounded-md ${ROLE_ICON_COLOR[ROLE_COLORS[i % ROLE_COLORS.length]] || ROLE_ICON_COLOR.default}`}>
            <MdSecurity size={15} />
          </div>
          <span className="font-semibold">{v}</span>
          {isSistema(row) && (
            <Badge variant="gray" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>Sistema</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'Estado',
      label: 'Estado',
      // Solo se muestra para roles de sistema (no tienen ToggleSwitch porque no se
      // pueden desactivar); en los demás el toggle de Acciones ya indica el estado.
      render: (_, row) => isSistema(row) ? <Badge variant="gray">Sistema</Badge> : null,
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_, row) => (
        <div className="table-actions">
          {!isSistema(row) && (
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
              {esSuperadmin && (
                <button
                  className="btn btn--ghost btn--icon btn--sm btn--danger-ghost"
                  title="Eliminar rol"
                  onClick={() => del.open(row.Id_Rol)}
                >
                  <MdDeleteForever size={17} />
                </button>
              )}
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
      <div className="px-2xl pt-xl max-lg:px-lg">
        <span className="mb-lg block text-caption font-bold uppercase tracking-wide text-text-muted">Resumen por rol</span>
        <div className="mb-xl grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-lg">
        {primaryCards.map(card => (
          <div key={card.nombre} className={`flex min-w-0 items-center gap-md rounded-lg border border-border bg-surface px-xl py-lg text-text transition-[box-shadow,transform] duration-200 hover:-translate-y-[2px] hover:shadow-md roles-primary-card--${card.color}`}>
            <div className={`flex size-11 shrink-0 items-center justify-center rounded-md ${ROLE_ICON_COLOR[card.color] || ROLE_ICON_COLOR.default}`}>
              <MdSecurity size={22} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <span className="text-body font-bold leading-tight text-text [overflow-wrap:anywhere]">{card.nombre}</span>
              <span className="flex items-center text-small text-text-muted">
                <MdPeople size={13} style={{ marginRight: '3px' }} />
                {card.count} persona(s)
              </span>
            </div>
          </div>
        ))}
        {otrosRoles.length > 0 && (
          <div className="flex min-w-0 items-center gap-md rounded-lg border border-border bg-surface px-xl py-lg text-text transition-[box-shadow,transform] duration-200 hover:-translate-y-[2px] hover:shadow-md roles-primary-card--default">
            <div className={`flex size-11 shrink-0 items-center justify-center rounded-md ${ROLE_ICON_COLOR.default}`}>
              <MdSecurity size={22} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <span className="text-body font-bold leading-tight text-text [overflow-wrap:anywhere]">Otros</span>
              <span className="flex items-center text-small text-text-muted">
                <MdPeople size={13} style={{ marginRight: '3px' }} />
                {otrosCount} persona(s)
              </span>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* ── Roles table ── */}
      <div className="grid grid-cols-1 gap-xl px-2xl pb-2xl max-lg:px-lg">
        <div className="card min-w-0">
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
            rowKey="Id_Rol"
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
            <button className="btn btn--primary" onClick={handleCreate} disabled={actionLoading || !!createNombreError || !createNombre.trim()}>
              {actionLoading ? 'Guardando...' : 'Crear'}
            </button>
          </>
        }
      >
        {createError && <div className="form-error-box">{createError}</div>}
        <div className="form-group">
          <label className="form-label">Nombre del rol <span className="required">*</span></label>
          <input
            className={`form-control ${createNombreError ? 'is-error' : ''}`}
            value={createNombre}
            onChange={e => setCreateNombre(e.target.value)}
            placeholder="Ej: Recepcionista"
            onKeyDown={e => e.key === 'Enter' && !createNombreError && createNombre.trim() && handleCreate(e)}
            maxLength={50}
            autoFocus
          />
          {createNombreError && <p className="form-error">{createNombreError}</p>}
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
              disabled={saving || matLoading || !!editNombreError || !formNombre.trim()}
            >
              {saving
                ? <><span className="size-4 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current" /> Guardando...</>
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
            className={`form-control ${editNombreError ? 'is-error' : ''}`}
            style={{ maxWidth: 320 }}
            value={formNombre}
            onChange={e => setFormNombre(e.target.value)}
            placeholder="Nombre del rol"
            maxLength={50}
          />
          {editNombreError && <p className="form-error">{editNombreError}</p>}
        </div>

        <div className="mb-lg mt-xs border-0 border-t border-border" />
        <p className="mb-xs text-caption font-bold uppercase tracking-wide text-text-muted">Permisos por módulo</p>
        <p className="mb-lg text-small text-text-muted">
          Activa o desactiva permisos individuales. La columna "Todo" marca/desmarca toda la fila.
        </p>

        {matLoading ? (
          <div className="flex flex-col gap-[4px]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex h-[42px] items-center gap-md rounded-sm px-sm" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="animate-pulse rounded-sm bg-neutral-soft h-[13px] flex-1" />
                {[0, 1, 2, 3, 4].map(j => (
                  <div key={j} className="animate-pulse rounded-sm bg-neutral-soft h-[13px] w-16 shrink-0" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[540px] border-collapse text-small">
              <thead>
                <tr>
                  <th className="whitespace-nowrap border-b-2 border-border bg-surface-solid px-lg py-sm text-left text-caption font-bold uppercase tracking-wide text-text-muted w-[200px] min-w-[160px]">Módulo</th>
                  {ACTIONS.map(action => (
                    <th key={action} className="whitespace-nowrap border-b-2 border-border bg-surface-solid px-lg py-sm text-left text-caption font-bold uppercase tracking-wide text-text-muted w-20 text-center">
                      <div className="flex flex-col items-center gap-xs">
                        <span>{action}</span>
                        <input
                          type="checkbox"
                          className="size-[15px] cursor-pointer rounded-sm align-middle accent-[var(--color-primary)]"
                          title={`Seleccionar columna "${action}"`}
                          checked={matrix.length > 0 && matrix.every(r => r[action] === 1)}
                          onChange={() => toggleCol(action)}
                        />
                      </div>
                    </th>
                  ))}
                  <th className="whitespace-nowrap border-b-2 border-border bg-surface-solid px-lg py-sm text-left text-caption font-bold uppercase tracking-wide text-text-muted w-20 text-center">
                    <span className="block text-center">Todo</span>
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
                      className={`h-11 transition-colors duration-100 hover:bg-primary-soft${idx % 2 !== 0 ? ' bg-neutral-soft' : ''}${someOn ? ' [&_td]:font-semibold' : ''}`}
                    >
                      <td className="h-11 border-b border-border px-lg align-middle rol-mat-td--mod">
                        <div className="flex items-center gap-sm font-medium text-text">
                          {Icon && (
                            <span className="flex shrink-0 items-center" style={{ color: meta?.color || '#F59E0B' }}>
                              <Icon size={15} />
                            </span>
                          )}
                          <span>{meta?.label || row.Modulo}</span>
                        </div>
                      </td>
                      {ACTIONS.map(action => {
                        const inaplicable = row.Modulo === 'Dashboard' && action !== 'Ver';
                        return (
                          <td key={action} className="h-11 border-b border-border px-lg align-middle text-center">
                            <input
                              type="checkbox"
                              className="size-[15px] cursor-pointer rounded-sm align-middle accent-[var(--color-primary)]"
                              checked={row[action] === 1}
                              disabled={inaplicable}
                              title={inaplicable ? 'No aplica: Dashboard es de solo lectura' : undefined}
                              onChange={() => toggleCell(row.Modulo, action)}
                            />
                          </td>
                        );
                      })}
                      <td className="h-11 border-b border-border px-lg align-middle text-center">
                        <input
                          type="checkbox"
                          className="size-[15px] cursor-pointer rounded-sm align-middle accent-[var(--color-primary)]"
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

      <EliminarRealModal
        isOpen={del.isOpen}
        onClose={del.close}
        entidadLabel="rol"
        preview={del.preview}
        loadingPreview={del.loadingPreview}
        deleting={del.deleting}
        error={del.error}
        onConfirm={del.confirm}
      />

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-xl right-xl z-[1400] flex items-center gap-sm rounded-md border px-lg py-md text-body font-medium shadow-lg ${TOAST_TIPO[toast.type] || TOAST_TIPO.success}`}>
          {toast.type === 'success' ? <MdCheck size={17} /> : <MdClose size={17} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
