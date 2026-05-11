import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit, MdWarning } from 'react-icons/md';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchRepuestos, createRepuesto, updateRepuesto, toggleRepuestoEstado } from '../slices/repuestosSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { sortByStatus, filterItems, formatCurrency } from '../../../shared/utils/helpers.js';
import api from '../../../shared/services/api.js';
import './RepuestosPage.css';

const EMPTY = { NombreRepuesto: '', Stock: '', Precio: '', Id_categoria: '' };

export default function RepuestosPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.repuestos);
  const [categorias, setCategorias]       = useState([]);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('todos');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [pageSize, setPageSize]           = useState(10);
  const [detailItem, setDetailItem]       = useState(null);
  const [formData, setFormData]           = useState(EMPTY);
  const [editingId, setEditingId]         = useState(null);
  const [showForm, setShowForm]           = useState(false);
  const [formError, setFormError]         = useState('');

  useEffect(() => {
    dispatch(fetchRepuestos());
    api.get('/api/categoria-repuestos').then(r => setCategorias(r.data?.data || r.data || [])).catch(() => {});
  }, [dispatch]);

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    if (categoriaFilter) list = list.filter(i => String(i.Id_Categoria ?? i.Id_categoria) === categoriaFilter);
    list = filterItems(list, search, ['Nombre', 'NombreRepuesto']);
    return sortByStatus(list);
  })();

  const openCreate = () => { setFormData(EMPTY); setEditingId(null); setFormError(''); setShowForm(true); };
  const openEdit = (item) => {
    setFormData({
      NombreRepuesto: item.NombreRepuesto || item.Nombre || '',
      Stock: item.Stock || '',
      Precio: item.Precio || '',
      Id_categoria: item.Id_categoria ?? item.Id_Categoria ?? '',
    });
    setEditingId(item.Id_Repuesto); setFormError(''); setShowForm(true);
  };
  const handleChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.NombreRepuesto || !formData.Id_categoria || !formData.Stock || !formData.Precio) {
      setFormError('Completa los campos obligatorios.'); return;
    }
    const payload = {
      NombreRepuesto: formData.NombreRepuesto,
      Stock: Number(formData.Stock),
      Precio: Number(formData.Precio),
      Id_categoria: Number(formData.Id_categoria),
    };
    const action = editingId ? updateRepuesto({ id: editingId, data: payload }) : createRepuesto(payload);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); dispatch(fetchRepuestos()); }
    else setFormError(result.payload || 'Error al guardar.');
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Nombre', label: 'Nombre', render: v => <span className="font-medium">{v}</span> },
    { key: 'Categoria', label: 'Categoría' },
    {
      key: 'Stock', label: 'Stock', render: v => (
        <span className={`stock-cell ${Number(v) < 5 ? 'stock-cell--low' : ''}`}>
          {Number(v) < 5 && <MdWarning size={14} style={{ marginRight: '3px' }} />}{v}
        </span>
      )
    },
    { key: 'Precio', label: 'Precio', render: v => formatCurrency(v) },
    { key: 'Estado', label: 'Estado', render: v => <StatusBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setDetailItem(row)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleRepuestoEstado({ id: row.Id_Repuesto, Estado: row.Estado === 1 ? 0 : 1 }))} />
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Repuestos</h1><p className="page__subtitle">{items.length} repuesto(s) en inventario</p></div>
        <button className="btn btn--primary" onClick={openCreate}><MdAdd size={18} />Nuevo repuesto</button>
      </div>
      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre..."
            filterSlot={
              <>
                <select className="filter-select" value={categoriaFilter} onChange={e => setCategoriaFilter(e.target.value)}>
                  <option value="">Todas las categorías</option>
                  {categorias.map(c => <option key={c.Id_categoria} value={c.Id_categoria}>{c.Nombre}</option>)}
                </select>
                <FilterDropdown
                  statusFilter={statusFilter}
                  onStatusChange={setStatusFilter}
                  pageSize={pageSize}
                  onPageSizeChange={setPageSize}
                />
              </>
            }
          />
        </div>
        <Table columns={columns} data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron repuestos" />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Detalle del repuesto" size="md">
        {detailItem && <div className="detail-grid">
          <div className="detail-item"><span className="detail-label">Nombre</span><span className="detail-value">{detailItem.Nombre}</span></div>
          <div className="detail-item"><span className="detail-label">Categoría</span><span className="detail-value">{detailItem.Categoria || detailItem.Id_Categoria}</span></div>
          <div className="detail-item"><span className="detail-label">Stock</span><span className="detail-value">{detailItem.Stock}</span></div>
          <div className="detail-item"><span className="detail-label">Precio</span><span className="detail-value">{formatCurrency(detailItem.Precio)}</span></div>
          <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><StatusBadge estado={detailItem.Estado} /></span></div>
        </div>}
      </Modal>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar repuesto' : 'Nuevo repuesto'} size="md"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="form-group span-2">
            <label className="form-label">Nombre <span className="required">*</span></label>
            <input name="NombreRepuesto" className="form-control" value={formData.NombreRepuesto} onChange={handleChange} placeholder="Nombre del repuesto" />
          </div>
          <div className="form-group span-2">
            <label className="form-label">Categoría <span className="required">*</span></label>
            <select name="Id_categoria" className="form-control" value={formData.Id_categoria} onChange={handleChange}>
              <option value="">Seleccionar categoría...</option>
              {categorias.map(c => <option key={c.Id_categoria} value={c.Id_categoria}>{c.Nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Stock <span className="required">*</span></label>
            <input name="Stock" type="number" min="0" className="form-control" value={formData.Stock} onChange={handleChange} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Precio <span className="required">*</span></label>
            <input name="Precio" type="number" min="0" step="0.01" className="form-control" value={formData.Precio} onChange={handleChange} placeholder="0" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
