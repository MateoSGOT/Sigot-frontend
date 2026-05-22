import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit } from 'react-icons/md';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchServicios, createServicio, updateServicio, toggleServicioEstado } from '../slices/serviciosSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { sortByStatus, filterItems, formatCurrency } from '../../../shared/utils/helpers.js';
import './ServiciosPage.css';

const EMPTY = { Nombre: '', Descripcion: '', Precio: '' };

export default function ServiciosPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.servicios);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize] = useState(5);
  const [detailItem, setDetailItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { dispatch(fetchServicios()); }, [dispatch]);

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    list = filterItems(list, search, ['Nombre', 'Descripcion']);
    return sortByStatus(list);
  })();

  const openCreate = () => { setFormData(EMPTY); setEditingId(null); setFormError(''); setShowForm(true); };
  const openEdit = (item) => { setFormData({ Nombre: item.Nombre || '', Descripcion: item.Descripcion || '', Precio: item.Precio || '' }); setEditingId(item.Id_Servicio); setFormError(''); setShowForm(true); };
  const handleChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.Nombre || !formData.Precio) { setFormError('Nombre y precio son obligatorios.'); return; }
    const action = editingId ? updateServicio({ id: editingId, data: formData }) : createServicio(formData);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); dispatch(fetchServicios()); }
    else setFormError(result.payload || 'Error al guardar.');
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Nombre', label: 'Nombre', render: v => <span className="font-medium">{v}</span> },
    { key: 'Descripcion', label: 'DescripciÃ³n', render: v => <span className="descripcion-cell">{v || 'â€”'}</span> },
    { key: 'Precio', label: 'Precio', render: v => formatCurrency(v) },
    { key: 'Estado', label: 'Estado', render: v => <StatusBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setDetailItem(row)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleServicioEstado({ id: row.Id_Servicio, Estado: row.Estado === 1 ? 0 : 1 }))} />
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Servicios</h1><p className="page__subtitle">{items.length} servicio(s) disponible(s)</p></div>
        <button className="btn btn--primary" onClick={openCreate}><MdAdd size={18} />Nuevo servicio</button>
      </div>
      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre, descripciÃ³n..."
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
        <Table columns={columns} data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron servicios" />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Detalle del servicio" size="md">
        {detailItem && <div className="detail-grid">
          <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Nombre</span><span className="detail-value">{detailItem.Nombre}</span></div>
          <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">DescripciÃ³n</span><span className="detail-value">{detailItem.Descripcion || 'â€”'}</span></div>
          <div className="detail-item"><span className="detail-label">Precio</span><span className="detail-value">{formatCurrency(detailItem.Precio)}</span></div>
          <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><StatusBadge estado={detailItem.Estado} /></span></div>
        </div>}
      </Modal>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar servicio' : 'Nuevo servicio'} size="md"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="form-group span-2"><label className="form-label">Nombre <span className="required">*</span></label><input name="Nombre" className="form-control" value={formData.Nombre} onChange={handleChange} placeholder="Nombre del servicio" /></div>
          <div className="form-group span-2"><label className="form-label">DescripciÃ³n</label><textarea name="Descripcion" className="form-control" value={formData.Descripcion} onChange={handleChange} rows={3} placeholder="Describe el servicio..." /></div>
          <div className="form-group span-2"><label className="form-label">Precio <span className="required">*</span></label><input name="Precio" type="number" min="0" className="form-control" value={formData.Precio} onChange={handleChange} placeholder="0" /></div>
        </form>
      </Modal>
    </div>
  );
}

