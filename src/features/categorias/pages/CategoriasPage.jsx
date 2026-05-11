import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdEdit } from 'react-icons/md';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchCategorias, createCategoria, updateCategoria, toggleCategoriaEstado } from '../slices/categoriasSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { sortByStatus, filterItems } from '../../../shared/utils/helpers.js';
import './CategoriasPage.css';

const EMPTY = { Nombre: '' };

export default function CategoriasPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.categorias);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize] = useState(10);
  const [formData, setFormData] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { dispatch(fetchCategorias()); }, [dispatch]);

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    list = filterItems(list, search, ['Nombre']);
    return sortByStatus(list);
  })();

  const openCreate = () => { setFormData(EMPTY); setEditingId(null); setFormError(''); setShowForm(true); };
  const openEdit = (item) => { setFormData({ Nombre: item.Nombre || '' }); setEditingId(item.Id_Categoria); setFormError(''); setShowForm(true); };
  const handleChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.Nombre) { setFormError('El nombre es obligatorio.'); return; }
    const action = editingId ? updateCategoria({ id: editingId, data: formData }) : createCategoria(formData);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); dispatch(fetchCategorias()); }
    else setFormError(result.payload || 'Error al guardar.');
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Nombre', label: 'Nombre', render: v => <span className="font-medium">{v}</span> },
    { key: 'Estado', label: 'Estado', render: v => <StatusBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleCategoriaEstado({ id: row.Id_Categoria, Estado: row.Estado === 1 ? 0 : 1 }))} />
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Categorías de repuesto</h1><p className="page__subtitle">{items.length} categoría(s) registrada(s)</p></div>
        <button className="btn btn--primary" onClick={openCreate}><MdAdd size={18} />Nueva categoría</button>
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
        <Table columns={columns} data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron categorías" />
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar categoría' : 'Nueva categoría'} size="sm"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <div className="form-group">
          <label className="form-label">Nombre <span className="required">*</span></label>
          <input name="Nombre" className="form-control" value={formData.Nombre} onChange={handleChange} placeholder="Nombre de la categoría" />
        </div>
      </Modal>
    </div>
  );
}
