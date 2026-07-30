import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdEdit, MdListAlt } from 'react-icons/md';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
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
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize] = useState(5);

  // Modal crear/editar marca
  const [marcaForm, setMarcaForm] = useState(null); // { id, Nombre } | null
  const [marcaError, setMarcaError] = useState('');

  // Modal gestionar modelos de una marca
  const [gestionId, setGestionId] = useState(null);
  const gestionMarca = items.find(m => m.Id_Marca === gestionId) || null;
  // Formulario inline de modelo dentro del panel de gestión
  const [modeloForm, setModeloForm] = useState(null); // { id, Nombre } | null
  const [modeloError, setModeloError] = useState('');

  useEffect(() => { dispatch(fetchMarcas()); }, [dispatch]);

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    list = filterItems(list, search, ['Nombre']);
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

  // ===== Modelos (dentro del panel de gestión) =====
  const openGestion = (m) => { setGestionId(m.Id_Marca); setModeloForm(null); setModeloError(''); };
  const closeGestion = () => { setGestionId(null); setModeloForm(null); setModeloError(''); };
  const startNuevoModelo = () => { setModeloForm({ id: null, Nombre: '' }); setModeloError(''); };
  const startEditarModelo = (mod) => { setModeloForm({ id: mod.Id_Modelo, Nombre: mod.Nombre || '' }); setModeloError(''); };
  const submitModelo = async () => {
    const Nombre = (modeloForm.Nombre || '').trim();
    if (Nombre.length < 1) { setModeloError('El nombre del modelo es obligatorio.'); return; }
    const action = modeloForm.id
      ? updateModelo({ id: modeloForm.id, data: { Nombre } })
      : createModelo({ idMarca: gestionId, data: { Nombre } });
    const r = await dispatch(action);
    if (!r.error) { setModeloForm(null); setModeloError(''); }
    else setModeloError(r.payload || 'No se pudo guardar el modelo.');
  };

  // ===== Columnas tabla de marcas =====
  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Nombre', label: 'Marca', render: v => <span className="font-medium">{v}</span> },
    { key: 'modelos', label: 'N° de modelos', render: v => (Array.isArray(v) ? v.length : 0) },
    { key: 'Estado', label: 'Estado', render: v => <StatusBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => openGestion(row)} title="Gestionar modelos"><MdListAlt size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" disabled={!puedeEditar} onClick={() => openEditMarca(row)} title="Editar marca"><MdEdit size={17} /></button>
          <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleMarcaEstado({ id: row.Id_Marca, Estado: row.Estado === 1 ? 0 : 1 }))} disabled={!puedeToggle} />
        </div>
      )
    },
  ];

  // ===== Columnas tabla pequeña de modelos =====
  const modeloColumns = [
    { key: 'Nombre', label: 'Modelo', render: v => <span className="font-medium">{v}</span> },
    { key: 'Estado', label: 'Estado', render: v => <StatusBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" disabled={!puedeEditar} onClick={() => startEditarModelo(row)} title="Editar modelo"><MdEdit size={16} /></button>
          <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleModeloEstado({ id: row.Id_Modelo, Estado: row.Estado === 1 ? 0 : 1 }))} disabled={!puedeToggle} />
        </div>
      )
    },
  ];

  const modelosData = gestionMarca?.modelos ? [...gestionMarca.modelos].sort((a, b) => (a.Nombre || '').localeCompare(b.Nombre || '')) : [];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Marcas y modelos</h1><p className="page__subtitle">{items.length} marca(s) registrada(s)</p></div>
        <button className="btn btn--primary" onClick={openCreateMarca} disabled={!puedeCrear}><MdAdd size={18} />Nueva marca</button>
      </div>

      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre..."
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
        <Table columns={columns} data={filtered} loading={loading} pageSize={pageSize} searchTerm={search} onClearSearch={() => setSearch('')} emptyMessage="No se encontraron marcas" />
      </div>

      {/* Modal crear/editar marca */}
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

      {/* Modal gestionar modelos */}
      <Modal isOpen={!!gestionMarca} onClose={closeGestion} title={gestionMarca ? `Modelos de ${gestionMarca.Nombre}` : 'Modelos'} size="md"
        footer={<button className="btn btn--outline" onClick={closeGestion}>Cerrar</button>}
      >
        {gestionMarca && (
          <>
            <div className="modelos-panel__head">
              <span className="modelos-panel__count">{modelosData.length} modelo(s)</span>
              {!modeloForm && (
                <button className="btn btn--primary btn--sm" onClick={startNuevoModelo} disabled={!puedeCrear}><MdAdd size={16} />Nuevo modelo</button>
              )}
            </div>

            {modeloForm && (
              <div className="modelo-inline-form">
                {modeloError && <div className="form-error-box">{modeloError}</div>}
                <div className="modelo-inline-form__row">
                  <input className="form-control" autoFocus value={modeloForm.Nombre}
                    onChange={e => setModeloForm(f => ({ ...f, Nombre: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') submitModelo(); if (e.key === 'Escape') setModeloForm(null); }}
                    placeholder={modeloForm.id ? 'Editar modelo' : 'Nombre del nuevo modelo (ej. Corolla)'} />
                  <button className="btn btn--primary btn--sm" onClick={submitModelo} disabled={actionLoading}>{actionLoading ? '...' : 'Guardar'}</button>
                  <button className="btn btn--outline btn--sm" onClick={() => { setModeloForm(null); setModeloError(''); }}>Cancelar</button>
                </div>
              </div>
            )}

            <Table columns={modeloColumns} data={modelosData} loading={false} pageSize={'all'} emptyMessage="Esta marca aún no tiene modelos" />
          </>
        )}
      </Modal>
    </div>
  );
}
