import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdSave } from 'react-icons/md';
import { fetchPermisos, updatePermiso } from '../slices/permisosSlice.js';
import './PermisosPage.css';

const ACTION_MAP = {
  LISTAR:         'Ver',
  CONSULTAR:      'Ver',
  REGISTRAR:      'Crear',
  CREAR:          'Crear',
  EDITAR:         'Editar',
  ACTUALIZAR:     'Editar',
  ELIMINAR:       'Eliminar',
  CAMBIAR_ESTADO: 'Eliminar',
};
const COLS = ['Ver', 'Crear', 'Editar', 'Eliminar'];

function groupPermisos(items) {
  const modules = {};
  items.forEach(p => {
    const parts = p.Nombre.split('.');
    const mod   = parts[0];
    const act   = parts[1] || '';
    const col   = ACTION_MAP[act] || act;
    if (!modules[mod]) modules[mod] = {};
    if (!modules[mod][col]) modules[mod][col] = [];
    modules[mod][col].push(p);
  });
  return modules;
}

export default function PermisosPage() {
  const dispatch = useDispatch();
  const { items, actionLoading } = useSelector(s => s.permisos);
  const [localState, setLocalState] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { dispatch(fetchPermisos()); }, [dispatch]);

  useEffect(() => {
    const s = {};
    items.forEach(p => { s[p.Id_Permiso] = p.Estado === 1; });
    setLocalState(s);
  }, [items]);

  const grouped  = groupPermisos(items);
  const modNames = Object.keys(grouped).sort();

  const toggle = (id) => setLocalState(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleRow = (mod) => {
    const all   = COLS.flatMap(col => grouped[mod]?.[col] || []);
    const allOn = all.every(p => localState[p.Id_Permiso]);
    setLocalState(prev => {
      const next = { ...prev };
      all.forEach(p => { next[p.Id_Permiso] = !allOn; });
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const changed = items.filter(p => (p.Estado === 1) !== !!localState[p.Id_Permiso]);
    for (const p of changed) {
      await dispatch(updatePermiso({ id: p.Id_Permiso, data: { Estado: localState[p.Id_Permiso] ? 1 : 0 } }));
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Permisos</h1>
          <p className="page__subtitle">Módulos del sistema — {items.length} permiso(s)</p>
        </div>
        <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
          <MdSave size={17} />{saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {saved && (
        <div style={{ margin: '0.5rem 2rem', padding: '0.75rem 1rem', background: 'rgba(181,242,61,0.12)', border: '1px solid rgba(181,242,61,0.3)', borderRadius: '8px', color: '#b5f23d', fontSize: '0.875rem' }}>
          ✓ Cambios guardados correctamente.
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="perm-matrix">
          <thead>
            <tr>
              <th className="perm-matrix__mod-col">Módulo</th>
              <th className="perm-matrix__todo-col">Todo</th>
              {COLS.map(c => <th key={c} className="perm-matrix__action-col">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {modNames.map(mod => {
              const allPerms = COLS.flatMap(col => grouped[mod]?.[col] || []);
              const allOn    = allPerms.length > 0 && allPerms.every(p => localState[p.Id_Permiso]);
              const someOn   = allPerms.some(p => localState[p.Id_Permiso]);
              return (
                <tr key={mod} className="perm-matrix__row">
                  <td className="perm-matrix__mod-name">{mod}</td>
                  <td className="perm-matrix__cell">
                    <input
                      type="checkbox"
                      className="perm-checkbox"
                      checked={allOn}
                      ref={el => { if (el) el.indeterminate = someOn && !allOn; }}
                      onChange={() => toggleRow(mod)}
                    />
                  </td>
                  {COLS.map(col => {
                    const perms = grouped[mod]?.[col] || [];
                    if (perms.length === 0) return <td key={col} className="perm-matrix__cell perm-matrix__cell--empty">—</td>;
                    return (
                      <td key={col} className="perm-matrix__cell">
                        {perms.map(p => (
                          <input
                            key={p.Id_Permiso}
                            type="checkbox"
                            className="perm-checkbox"
                            checked={!!localState[p.Id_Permiso]}
                            onChange={() => toggle(p.Id_Permiso)}
                            title={p.Nombre}
                          />
                        ))}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
