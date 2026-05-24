import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  MdAdd, MdSave, MdCheck, MdClose,
  MdPeople, MdDirectionsCar, MdPeopleAlt, MdBuild,
  MdCategory, MdLocalShipping, MdShoppingCart,
  MdMiscellaneousServices, MdEventNote, MdAssignment,
  MdNewReleases, MdDashboard, MdSecurity, MdAdminPanelSettings,
} from 'react-icons/md';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import api from '../../../shared/services/api.js';
import './PrivilegiosPage.css';

const ACTIONS = ['Ver', 'Crear', 'Editar', 'Eliminar'];

const MODULE_META = {
  'Clientes':    { icon: MdPeople,                label: 'Clientes'    },
  'Vehículos':   { icon: MdDirectionsCar,         label: 'Vehículos'   },
  'Empleados':   { icon: MdPeopleAlt,             label: 'Empleados'   },
  'Repuestos':   { icon: MdBuild,                 label: 'Repuestos'   },
  'Categorías':  { icon: MdCategory,              label: 'Categorías'  },
  'Proveedores': { icon: MdLocalShipping,         label: 'Proveedores' },
  'Compras':     { icon: MdShoppingCart,          label: 'Compras'     },
  'Servicios':   { icon: MdMiscellaneousServices, label: 'Servicios'   },
  'Agenda':      { icon: MdEventNote,             label: 'Agenda'      },
  'Órdenes':     { icon: MdAssignment,            label: 'Órdenes'     },
  'Novedades':   { icon: MdNewReleases,           label: 'Novedades'   },
  'Dashboard':   { icon: MdDashboard,             label: 'Dashboard'   },
  'Roles':       { icon: MdSecurity,              label: 'Roles'       },
  'Permisos':    { icon: MdAdminPanelSettings,    label: 'Permisos'    },
};

const hasAcceso = (row) => !!(row.Ver || row.Crear || row.Editar || row.Eliminar);

export default function PrivilegiosPage() {
  const [roles,        setRoles]        = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [activeRolId,  setActiveRolId]  = useState(null);
  const [matrix,       setMatrix]       = useState([]);
  const [matLoading,   setMatLoading]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState(null);

  const [showNuevoRol, setShowNuevoRol] = useState(false);
  const [newRolNombre, setNewRolNombre] = useState('');
  const [newRolError,  setNewRolError]  = useState('');
  const [creatingRol,  setCreatingRol]  = useState(false);

  const toastTimer = useRef(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const r = await api.get('/api/roles');
      const list = r.data?.data || r.data || [];
      setRoles(list);
      return list;
    } catch {
      setRoles([]);
      return [];
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles().then(list => {
      if (list.length > 0) setActiveRolId(list[0].Id_Rol);
    });
    return () => clearTimeout(toastTimer.current);
  }, [loadRoles]);

  const loadMatrix = useCallback(async (id_rol) => {
    setMatLoading(true);
    try {
      const r = await api.get(`/api/permisos/rol/${id_rol}`);
      const data = r.data?.data || r.data || [];
      setMatrix(data.map(row => ({ ...row })));
    } catch {
      setMatrix([]);
    } finally {
      setMatLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeRolId) loadMatrix(activeRolId);
  }, [activeRolId, loadMatrix]);

  const toggleAcceso = (modulo) => {
    setMatrix(prev => prev.map(row => {
      if (row.Modulo !== modulo) return row;
      if (hasAcceso(row)) return { ...row, Ver: 0, Crear: 0, Editar: 0, Eliminar: 0 };
      return { ...row, Ver: 1, Crear: 1, Editar: 0, Eliminar: 0 };
    }));
  };

  const toggleCell = (modulo, action) => {
    setMatrix(prev => prev.map(row =>
      row.Modulo === modulo ? { ...row, [action]: row[action] ? 0 : 1 } : row
    ));
  };

  const toggleRow = (modulo) => {
    const row = matrix.find(r => r.Modulo === modulo);
    if (!row || !hasAcceso(row)) return;
    const allOn = ACTIONS.every(a => row[a] === 1);
    const val = allOn ? 0 : 1;
    setMatrix(prev => prev.map(r =>
      r.Modulo === modulo ? { ...r, Ver: val, Crear: val, Editar: val, Eliminar: val } : r
    ));
  };

  const toggleCol = (action) => {
    const enabled = matrix.filter(r => hasAcceso(r));
    const allOn = enabled.length > 0 && enabled.every(r => r[action] === 1);
    setMatrix(prev => prev.map(r => hasAcceso(r) ? { ...r, [action]: allOn ? 0 : 1 } : r));
  };

  const handleSave = async () => {
    if (!activeRolId) return;
    setSaving(true);
    try {
      await api.put(`/api/permisos/rol/${activeRolId}`, matrix);
      const rolName = roles.find(r => r.Id_Rol === activeRolId)?.Nombre || '';
      showToast('success', `Permisos de ${rolName} actualizados`);
    } catch {
      showToast('error', 'Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleNuevoRol = async (e) => {
    e.preventDefault();
    if (!newRolNombre.trim()) { setNewRolError('El nombre es obligatorio.'); return; }
    setCreatingRol(true);
    setNewRolError('');
    try {
      const r = await api.post('/api/roles', { Nombre: newRolNombre.trim() });
      const created = r.data?.data || r.data;
      setShowNuevoRol(false);
      setNewRolNombre('');
      const list = await loadRoles();
      const newId = created?.Id_Rol;
      if (newId) setActiveRolId(newId);
      else if (list.length > 0) setActiveRolId(list[list.length - 1].Id_Rol);
    } catch (err) {
      setNewRolError(err?.response?.data?.message || 'Error al crear el rol.');
    } finally {
      setCreatingRol(false);
    }
  };

  const activeRol   = roles.find(r => r.Id_Rol === activeRolId);
  const enabledRows = matrix.filter(r => hasAcceso(r));

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Privilegios del sistema</h1>
          <p className="page__subtitle">Gestiona el acceso y los permisos por rol</p>
        </div>
        <button className="btn btn--primary" onClick={() => { setNewRolNombre(''); setNewRolError(''); setShowNuevoRol(true); }}>
          <MdAdd size={18} /> Nuevo rol
        </button>
      </div>

      <div className="card priv-card">
        {/* ── Tabs ── */}
        {rolesLoading ? (
          <div className="priv-tabs priv-tabs--loading">
            {[90, 100, 80, 110].map(w => (
              <div key={w} className="priv-tab-skel" style={{ width: w }} />
            ))}
          </div>
        ) : (
          <div className="priv-tabs">
            {roles.map(rol => (
              <button
                key={rol.Id_Rol}
                className={`priv-tab${activeRolId === rol.Id_Rol ? ' priv-tab--active' : ''}`}
                onClick={() => setActiveRolId(rol.Id_Rol)}
              >
                {rol.Nombre}
                {(rol.Estado === 0 || rol.Estado === false) && (
                  <span className="priv-tab-badge">Inactivo</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Matrix ── */}
        <div className="priv-body">
          {matLoading ? (
            <div className="priv-skeleton">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="priv-skel-row" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="priv-skel-cell priv-skel-cell--module" />
                  <div className="priv-skel-cell priv-skel-cell--toggle" />
                  {[0,1,2,3,4].map(j => (
                    <div key={j} className="priv-skel-cell priv-skel-cell--check" />
                  ))}
                </div>
              ))}
            </div>
          ) : matrix.length === 0 ? (
            <div className="priv-empty">Sin módulos configurados para este rol.</div>
          ) : (
            <>
              <div className="priv-table-wrap">
                <table className="priv-table">
                  <thead>
                    <tr className="priv-thead-row">
                      <th className="priv-th priv-th--module">Módulo</th>
                      <th className="priv-th priv-th--toggle">Acceso</th>
                      {ACTIONS.map(action => (
                        <th key={action} className="priv-th priv-th--action">
                          <div className="priv-th-inner">
                            <span>{action}</span>
                            <input
                              type="checkbox"
                              className="priv-check priv-check--header"
                              title={`Marcar/desmarcar columna "${action}"`}
                              checked={enabledRows.length > 0 && enabledRows.every(r => r[action] === 1)}
                              onChange={() => toggleCol(action)}
                            />
                          </div>
                        </th>
                      ))}
                      <th className="priv-th priv-th--action">
                        <span className="priv-th-todo">Todo</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row, idx) => {
                      const acceso = hasAcceso(row);
                      const allOn  = ACTIONS.every(a => row[a] === 1);
                      const meta   = MODULE_META[row.Modulo];
                      const Icon   = meta?.icon;
                      return (
                        <tr
                          key={row.Modulo}
                          className={`priv-row${idx % 2 !== 0 ? ' priv-row--alt' : ''}${!acceso ? ' priv-row--off' : ''}`}
                        >
                          <td className="priv-td priv-td--module">
                            <div className="priv-module-cell">
                              {Icon && <Icon size={16} className="priv-module-icon" />}
                              <span>{meta?.label || row.Modulo}</span>
                            </div>
                          </td>
                          <td className="priv-td priv-td--toggle">
                            <ToggleSwitch
                              checked={acceso}
                              onChange={() => toggleAcceso(row.Modulo)}
                            />
                          </td>
                          {ACTIONS.map(action => (
                            <td key={action} className="priv-td priv-td--check">
                              <input
                                type="checkbox"
                                className="priv-check"
                                checked={row[action] === 1}
                                disabled={!acceso}
                                onChange={() => toggleCell(row.Modulo, action)}
                              />
                            </td>
                          ))}
                          <td className="priv-td priv-td--check">
                            <input
                              type="checkbox"
                              className="priv-check"
                              title="Marcar/desmarcar toda la fila"
                              checked={acceso && allOn}
                              disabled={!acceso}
                              onChange={() => toggleRow(row.Modulo)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Footer ── */}
              <div className="priv-footer">
                <p className="priv-footer-hint">Los cambios se aplican inmediatamente al guardar</p>
                <button
                  className="btn btn--primary priv-save-btn"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <><span className="priv-spinner" /> Guardando...</>
                  ) : (
                    <><MdSave size={17} /> Guardar cambios para {activeRol?.Nombre || ''}</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`priv-toast priv-toast--${toast.type}`}>
          {toast.type === 'success'
            ? <MdCheck size={18} />
            : <MdClose size={18} />
          }
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ── Nuevo Rol Modal ── */}
      <Modal
        isOpen={showNuevoRol}
        onClose={() => setShowNuevoRol(false)}
        title="Nuevo rol"
        size="sm"
        footer={
          <>
            <button className="btn btn--outline" onClick={() => setShowNuevoRol(false)}>Cancelar</button>
            <button className="btn btn--primary" onClick={handleNuevoRol} disabled={creatingRol}>
              {creatingRol ? 'Creando...' : 'Crear rol'}
            </button>
          </>
        }
      >
        {newRolError && <div className="form-error-box">{newRolError}</div>}
        <div className="form-group">
          <label className="form-label">Nombre del rol <span className="required">*</span></label>
          <input
            className="form-control"
            value={newRolNombre}
            onChange={e => setNewRolNombre(e.target.value)}
            placeholder="Ej: Recepcionista"
            onKeyDown={e => e.key === 'Enter' && handleNuevoRol(e)}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
