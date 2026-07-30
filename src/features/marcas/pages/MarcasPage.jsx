import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdEdit } from 'react-icons/md';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { sortByStatus, filterItems } from '../../../shared/utils/helpers.js';
import {
  fetchMarcas, createMarca, updateMarca, toggleMarcaEstado,
  createModelo, updateModelo, toggleModeloEstado,
} from '../slices/marcasSlice.js';
import './MarcasPage.css';

export default function MarcasPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.marcas);
  const puedeCrear  = usePermiso('VEHICULOS.REGISTRAR');
  const puedeEditar = usePermiso('VEHICULOS.EDITAR');
  const puedeToggle = usePermiso('VEHICULOS.CAMBIAR_ESTADO');

  const [search, setSearch] = useState('');
  // Modal de marca
  const [marcaForm, setMarcaForm] = useState(null); // { id, Nombre } | null
  const [marcaError, setMarcaError] = useState('');
  // Modal de modelo
  const [modeloForm, setModeloForm] = useState(null); // { id, idMarca, Nombre } | null
  const [modeloError, setModeloError] = useState('');

  useEffect(() => { dispatch(fetchMarcas()); }, [dispatch]);

  const filtered = (() => {
    let list = filterItems(items, search, ['Nombre']);
    return sortByStatus(list);
  })();

  // ===== Marca =====
  const openCreateMarca = () => { setMarcaForm({ id: null, Nombre: '' }); setMarcaError(''); };
  const openEditMarca = (m) => { setMarcaForm({ id: m.Id_Marca, Nombre: m.Nombre || '' }); setMarcaError(''); };
  const submitMarca = async () => {
    const Nombre = (marcaForm.Nombre || '').trim();
    if (Nombre.length < 2) { setMarcaError('El nombre de la marca debe tener al menos 2 caracteres.'); return; }
    const action = marcaForm.id
      ? updateMarca({ id: marcaForm.id, data: { Nombre } })
      : createMarca({ Nombre });
    const r = await dispatch(action);
    if (!r.error) { setMarcaForm(null); dispatch(fetchMarcas()); }
    else setMarcaError(r.payload || 'No se pudo guardar la marca.');
  };

  // ===== Modelo =====
  const openCreateModelo = (idMarca) => { setModeloForm({ id: null, idMarca, Nombre: '' }); setModeloError(''); };
  const openEditModelo = (mod) => { setModeloForm({ id: mod.Id_Modelo, idMarca: mod.Id_Marca, Nombre: mod.Nombre || '' }); setModeloError(''); };
  const submitModelo = async () => {
    const Nombre = (modeloForm.Nombre || '').trim();
    if (Nombre.length < 1) { setModeloError('El nombre del modelo es obligatorio.'); return; }
    const action = modeloForm.id
      ? updateModelo({ id: modeloForm.id, data: { Nombre } })
      : createModelo({ idMarca: modeloForm.idMarca, data: { Nombre } });
    const r = await dispatch(action);
    if (!r.error) setModeloForm(null);
    else setModeloError(r.payload || 'No se pudo guardar el modelo.');
  };

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Marcas y modelos</h1><p className="page__subtitle">{items.length} marca(s) registrada(s)</p></div>
        <button className="btn btn--primary" onClick={openCreateMarca} disabled={!puedeCrear}><MdAdd size={18} />Nueva marca</button>
      </div>

      <div className="card">
        <div className="card__header">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar marca..." />
        </div>

        {loading ? (
          <div className="marcas-empty">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="marcas-empty">No se encontraron marcas.</div>
        ) : (
          <div className="marcas-grid">
            {filtered.map(marca => (
              <div key={marca.Id_Marca} className={`marca-card ${marca.Estado === 0 ? 'marca-card--inactive' : ''}`}>
                <div className="marca-card__head">
                  <div className="marca-card__title">
                    <span className="marca-card__name">{marca.Nombre}</span>
                    <StatusBadge estado={marca.Estado} />
                  </div>
                  <div className="marca-card__actions">
                    <button className="btn btn--ghost btn--icon btn--sm" disabled={!puedeEditar} onClick={() => openEditMarca(marca)} title="Editar marca"><MdEdit size={16} /></button>
                    <ToggleSwitch checked={marca.Estado === 1} onChange={() => dispatch(toggleMarcaEstado({ id: marca.Id_Marca, Estado: marca.Estado === 1 ? 0 : 1 }))} disabled={!puedeToggle} />
                  </div>
                </div>

                <div className="marca-card__modelos">
                  <div className="marca-card__modelos-head">
                    <span className="marca-card__modelos-label">Modelos ({marca.modelos?.length || 0})</span>
                    <button className="btn btn--ghost btn--sm" disabled={!puedeCrear} onClick={() => openCreateModelo(marca.Id_Marca)}><MdAdd size={14} />Agregar</button>
                  </div>
                  {(!marca.modelos || marca.modelos.length === 0) ? (
                    <p className="marca-card__no-modelos">Sin modelos aún.</p>
                  ) : (
                    <ul className="modelo-list">
                      {marca.modelos.map(mod => (
                        <li key={mod.Id_Modelo} className={`modelo-item ${mod.Estado === 0 ? 'modelo-item--inactive' : ''}`}>
                          <span className="modelo-item__name">{mod.Nombre}</span>
                          <div className="modelo-item__actions">
                            <button className="btn btn--ghost btn--icon btn--sm" disabled={!puedeEditar} onClick={() => openEditModelo(mod)} title="Editar modelo"><MdEdit size={14} /></button>
                            <ToggleSwitch checked={mod.Estado === 1} onChange={() => dispatch(toggleModeloEstado({ id: mod.Id_Modelo, Estado: mod.Estado === 1 ? 0 : 1 }))} disabled={!puedeToggle} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Marca */}
      <Modal isOpen={!!marcaForm} onClose={() => setMarcaForm(null)} title={marcaForm?.id ? 'Editar marca' : 'Nueva marca'} size="sm"
        footer={<><button className="btn btn--outline" onClick={() => setMarcaForm(null)}>Cancelar</button><button className="btn btn--primary" onClick={submitMarca} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {marcaError && <div className="form-error-box">{marcaError}</div>}
        <div className="form-group">
          <label className="form-label">Nombre <span className="required">*</span></label>
          <input className="form-control" value={marcaForm?.Nombre || ''} autoFocus
            onChange={e => setMarcaForm(f => ({ ...f, Nombre: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') submitMarca(); }}
            placeholder="Ej. Toyota" />
        </div>
      </Modal>

      {/* Modal Modelo */}
      <Modal isOpen={!!modeloForm} onClose={() => setModeloForm(null)} title={modeloForm?.id ? 'Editar modelo' : 'Nuevo modelo'} size="sm"
        footer={<><button className="btn btn--outline" onClick={() => setModeloForm(null)}>Cancelar</button><button className="btn btn--primary" onClick={submitModelo} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {modeloError && <div className="form-error-box">{modeloError}</div>}
        <div className="form-group">
          <label className="form-label">Nombre <span className="required">*</span></label>
          <input className="form-control" value={modeloForm?.Nombre || ''} autoFocus
            onChange={e => setModeloForm(f => ({ ...f, Nombre: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') submitModelo(); }}
            placeholder="Ej. Corolla" />
        </div>
      </Modal>
    </div>
  );
}
