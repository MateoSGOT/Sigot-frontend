import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdSave, MdCheck } from 'react-icons/md';
import { fetchRoles, createRol } from '../../roles/slices/rolesSlice.js';
import { permisosService } from '../../permisos/services/permisosService.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import './PrivilegiosPage.css';

const ACTIONS = ['Ver', 'Crear', 'Editar', 'Eliminar'];

export default function PrivilegiosPage() {
  const dispatch = useDispatch();
  const { items: roles, loading: rolesLoading } = useSelector(s => s.roles);

  const [activeRolId, setActiveRolId] = useState(null);
  const [matrix, setMatrix] = useState([]);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [showNuevoRol, setShowNuevoRol] = useState(false);
  const [newRolForm, setNewRolForm] = useState({ Nombre: '', Descripcion: '' });
  const [newRolError, setNewRolError] = useState('');
  const [creatingRol, setCreatingRol] = useState(false);

  useEffect(() => { dispatch(fetchRoles()); }, [dispatch]);

  useEffect(() => {
    if (roles.length > 0 && !activeRolId) setActiveRolId(roles[0].Id_Rol);
  }, [roles, activeRolId]);

  const loadMatrix = useCallback(async (id_rol) => {
    setMatrixLoading(true);
    setSaveMsg('');
    try {
      const data = await permisosService.getByRol(id_rol);
      setMatrix(Array.isArray(data) ? data : []);
    } catch {
      setMatrix([]);
    } finally {
      setMatrixLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeRolId) loadMatrix(activeRolId);
  }, [activeRolId, loadMatrix]);

  const toggle = (modulo, action) => {
    setMatrix(prev => prev.map(row =>
      row.Modulo === modulo ? { ...row, [action]: row[action] ? 0 : 1 } : row
    ));
    setSaveMsg('');
  };

  const toggleRow = (modulo) => {
    const row = matrix.find(r => r.Modulo === modulo);
    const allOn = ACTIONS.every(a => row[a] === 1);
    setMatrix(prev => prev.map(r =>
      r.Modulo === modulo ? { ...r, ...Object.fromEntries(ACTIONS.map(a => [a, allOn ? 0 : 1])) } : r
    ));
    setSaveMsg('');
  };

  const toggleCol = (action) => {
    const allOn = matrix.every(r => r[action] === 1);
    setMatrix(prev => prev.map(r => ({ ...r, [action]: allOn ? 0 : 1 })));
    setSaveMsg('');
  };

  const handleSave = async () => {
    if (!activeRolId) return;
    setSaving(true);
    setSaveMsg('');
    try {
      await permisosService.saveByRol(activeRolId, matrix);
      setSaveMsg('Cambios guardados correctamente.');
    } catch {
      setSaveMsg('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleNuevoRol = async (e) => {
    e.preventDefault();
    if (!newRolForm.Nombre.trim()) { setNewRolError('El nombre es obligatorio.'); return; }
    setCreatingRol(true);
    setNewRolError('');
    const result = await dispatch(createRol({ Nombre: newRolForm.Nombre.trim(), Descripcion: newRolForm.Descripcion.trim() || undefined }));
    setCreatingRol(false);
    if (!result.error) {
      setShowNuevoRol(false);
      setNewRolForm({ Nombre: '', Descripcion: '' });
      const created = result.payload;
      if (created?.Id_Rol) setActiveRolId(created.Id_Rol);
    } else {
      setNewRolError(result.payload || 'Error al crear el rol.');
    }
  };

  const activeRol = roles.find(r => r.Id_Rol === activeRolId);

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Privilegios</h1>
          <p className="page__subtitle">Asigna permisos por módulo para cada rol</p>
        </div>
        <button className="btn btn--primary" onClick={() => { setNewRolForm({ Nombre: '', Descripcion: '' }); setNewRolError(''); setShowNuevoRol(true); }}>
          <MdAdd size={18} /> Nuevo rol
        </button>
      </div>

      {rolesLoading ? (
        <div className="priv-loading">Cargando roles...</div>
      ) : (
        <div className="card">
          {/* Tabs */}
          <div className="priv-tabs">
            {roles.map(rol => (
              <button
                key={rol.Id_Rol}
                className={`priv-tab${activeRolId === rol.Id_Rol ? ' priv-tab--active' : ''}${!rol.Estado ? ' priv-tab--inactive' : ''}`}
                onClick={() => setActiveRolId(rol.Id_Rol)}
              >
                {rol.Nombre}
              </button>
            ))}
          </div>

          {/* Matrix */}
          <div className="priv-matrix-wrap">
            {matrixLoading ? (
              <div className="priv-loading">Cargando permisos...</div>
            ) : matrix.length === 0 ? (
              <div className="priv-loading">Sin módulos configurados.</div>
            ) : (
              <>
                <table className="priv-table">
                  <thead>
                    <tr>
                      <th className="priv-th priv-th--module">Módulo</th>
                      {ACTIONS.map(action => (
                        <th key={action} className="priv-th priv-th--action">
                          <div className="priv-th-action-wrap">
                            <span>{action}</span>
                            <input
                              type="checkbox"
                              className="priv-check"
                              title={`Todo: ${action}`}
                              checked={matrix.length > 0 && matrix.every(r => r[action] === 1)}
                              onChange={() => toggleCol(action)}
                            />
                          </div>
                        </th>
                      ))}
                      <th className="priv-th priv-th--action">
                        <div className="priv-th-action-wrap">
                          <span>Todo</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map(row => {
                      const allOn = ACTIONS.every(a => row[a] === 1);
                      return (
                        <tr key={row.Modulo} className="priv-row">
                          <td className="priv-td priv-td--module">{row.Modulo}</td>
                          {ACTIONS.map(action => (
                            <td key={action} className="priv-td priv-td--check">
                              <input
                                type="checkbox"
                                className="priv-check"
                                checked={row[action] === 1}
                                onChange={() => toggle(row.Modulo, action)}
                              />
                            </td>
                          ))}
                          <td className="priv-td priv-td--check">
                            <input
                              type="checkbox"
                              className="priv-check"
                              title="Activar/desactivar todos"
                              checked={allOn}
                              onChange={() => toggleRow(row.Modulo)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="priv-footer">
                  {saveMsg && (
                    <span className={`priv-save-msg${saveMsg.startsWith('Error') ? ' priv-save-msg--error' : ''}`}>
                      {!saveMsg.startsWith('Error') && <MdCheck size={16} />} {saveMsg}
                    </span>
                  )}
                  <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
                    <MdSave size={17} /> {saving ? 'Guardando...' : `Guardar — ${activeRol?.Nombre || ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Nuevo rol modal */}
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
        <form className="form-grid" onSubmit={handleNuevoRol} noValidate>
          <div className="form-group span-2">
            <label className="form-label">Nombre <span className="required">*</span></label>
            <input className="form-control" value={newRolForm.Nombre} onChange={e => setNewRolForm(p => ({ ...p, Nombre: e.target.value }))} placeholder="Nombre del rol" />
          </div>
          <div className="form-group span-2">
            <label className="form-label">Descripción</label>
            <input className="form-control" value={newRolForm.Descripcion} onChange={e => setNewRolForm(p => ({ ...p, Descripcion: e.target.value }))} placeholder="Descripción (opcional)" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
