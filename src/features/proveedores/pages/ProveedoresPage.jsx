import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit } from 'react-icons/md';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchProveedores, createProveedor, updateProveedor, toggleProveedorEstado } from '../slices/proveedoresSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { sortByStatus, filterItems } from '../../../shared/utils/helpers.js';
import './ProveedoresPage.css';

const EMPTY = { Documento: '', TipoProveedor: '', nombre: '', correo: '', contacto: '', ciudad: '', direccion: '', detalles: '' };

export default function ProveedoresPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.proveedores);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize] = useState(10);
  const [detailItem, setDetailItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { dispatch(fetchProveedores()); }, [dispatch]);

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    list = filterItems(list, search, ['Nombre', 'nombre', 'Documento', 'Correo', 'correo', 'Contacto', 'contacto']);
    return sortByStatus(list);
  })();

  const openCreate = () => { setFormData(EMPTY); setEditingId(null); setFormError(''); setShowForm(true); };
  const openEdit = (item) => {
    setFormData({
      Documento: item.Documento || '', TipoProveedor: item.TipoProveedor || '',
      nombre: item.nombre || '', correo: item.correo || '',
      contacto: item.contacto || '', ciudad: item.ciudad || '',
      direccion: item.direccion || '', detalles: item.detalles || '',
    });
    setEditingId(item.Id_Proveedor); setFormError(''); setShowForm(true);
  };
  const handleChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.Documento || !formData.TipoProveedor || !formData.nombre) {
      setFormError('Documento, tipo de proveedor y nombre son obligatorios.'); return;
    }
    const action = editingId ? updateProveedor({ id: editingId, data: formData }) : createProveedor(formData);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); dispatch(fetchProveedores()); }
    else setFormError(result.payload || 'Error al guardar.');
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Nombre', label: 'Nombre', render: v => <span className="font-medium">{v}</span> },
    { key: 'Documento', label: 'Documento' },
    { key: 'TipoProveedor', label: 'Tipo' },
    { key: 'Contacto', label: 'Contacto', render: v => v || '—' },
    { key: 'Correo', label: 'Correo', render: v => v || '—' },
    { key: 'Estado', label: 'Estado', render: v => <StatusBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setDetailItem(row)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleProveedorEstado({ id: row.Id_Proveedor, Estado: row.Estado === 1 ? 0 : 1 }))} />
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Proveedores</h1><p className="page__subtitle">{items.length} proveedor(es) registrado(s)</p></div>
        <button className="btn btn--primary" onClick={openCreate}><MdAdd size={18} />Nuevo proveedor</button>
      </div>
      <div className="card">
        <div className="card__header">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, documento, contacto..."
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
        <Table columns={columns} data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron proveedores" />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Detalle del proveedor" size="md">
        {detailItem && <div className="detail-grid">
          <div className="detail-item"><span className="detail-label">Nombre</span><span className="detail-value">{detailItem.Nombre}</span></div>
          <div className="detail-item"><span className="detail-label">Documento</span><span className="detail-value">{detailItem.Documento || '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Tipo</span><span className="detail-value">{detailItem.TipoProveedor || '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Contacto</span><span className="detail-value">{detailItem.Contacto || '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Correo</span><span className="detail-value">{detailItem.Correo || '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Ciudad</span><span className="detail-value">{detailItem.ciudad || '—'}</span></div>
          <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Dirección</span><span className="detail-value">{detailItem.direccion || '—'}</span></div>
          {detailItem.detalles && (
            <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Detalles</span><span className="detail-value">{detailItem.detalles}</span></div>
          )}
          <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><StatusBadge estado={detailItem.Estado} /></span></div>
        </div>}
      </Modal>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar proveedor' : 'Nuevo proveedor'} size="lg"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Documento <span className="required">*</span></label>
            <input name="Documento" className="form-control" value={formData.Documento} onChange={handleChange} placeholder="Número de documento o NIT" />
          </div>
          <div className="form-group">
            <label className="form-label">Tipo de proveedor <span className="required">*</span></label>
            <select name="TipoProveedor" className="form-control" value={formData.TipoProveedor} onChange={handleChange}>
              <option value="">Seleccionar...</option>
              <option value="Natural">Natural</option>
              <option value="Juridico">Juridico</option>
            </select>
          </div>
          <div className="form-group span-2">
            <label className="form-label">Nombre <span className="required">*</span></label>
            <input name="nombre" className="form-control" value={formData.nombre} onChange={handleChange} placeholder="Nombre del proveedor o empresa" />
          </div>
          <div className="form-group">
            <label className="form-label">Correo</label>
            <input name="correo" type="email" className="form-control" value={formData.correo} onChange={handleChange} placeholder="correo@proveedor.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Contacto</label>
            <input name="contacto" className="form-control" value={formData.contacto} onChange={handleChange} placeholder="Teléfono o persona de contacto" />
          </div>
          <div className="form-group">
            <label className="form-label">Ciudad</label>
            <input name="ciudad" className="form-control" value={formData.ciudad} onChange={handleChange} placeholder="Ciudad" />
          </div>
          <div className="form-group">
            <label className="form-label">Dirección</label>
            <input name="direccion" className="form-control" value={formData.direccion} onChange={handleChange} placeholder="Dirección" />
          </div>
          <div className="form-group span-2">
            <label className="form-label">Detalles</label>
            <textarea name="detalles" className="form-control" value={formData.detalles} onChange={handleChange} rows={3} placeholder="Información adicional..." />
          </div>
        </form>
      </Modal>
    </div>
  );
}
