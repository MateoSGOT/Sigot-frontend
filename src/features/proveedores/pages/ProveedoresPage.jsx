import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit } from 'react-icons/md';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchProveedores, createProveedor, updateProveedor, toggleProveedorEstado } from '../slices/proveedoresSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { sortByStatus, filterItems } from '../../../shared/utils/helpers.js';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import { MUNICIPIOS_POR_DEPARTAMENTO } from '../../../shared/data/colombiaGeo.js';
import './ProveedoresPage.css';

const DEPARTAMENTOS = Object.keys(MUNICIPIOS_POR_DEPARTAMENTO).sort().map(d => ({ label: d, value: d }));

const EMPTY = { TipoProveedor: '', Documento: '', nombre: '', correo: '', contacto: '', departamento: '', ciudad: '', direccion: '', detalles: '' };
const RULES = {
  TipoProveedor: (v) => V.requiredSelect(v, 'El tipo de proveedor'),
  Documento:     V.documento,
  nombre:        (v) => V.nombre(v, 3),
  correo:        (v) => V.correo(v, true),
};

export default function ProveedoresPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.proveedores);
  const puedeCrear   = usePermiso('PROVEEDORES.REGISTRAR');
  const puedeEditar  = usePermiso('PROVEEDORES.EDITAR');
  const puedeToggle  = usePermiso('PROVEEDORES.CAMBIAR_ESTADO');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize] = useState(5);
  const [detailItem, setDetailItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const { errors, touched, setErrors, revalidate, markTouched, touchAll, fieldError, isInvalid, validateNow, reset } = useFormValidation(RULES);

  useEffect(() => { dispatch(fetchProveedores()); }, [dispatch]);

  const ciudadesOpts = formData.departamento
    ? (MUNICIPIOS_POR_DEPARTAMENTO[formData.departamento] || []).map(c => ({ label: c, value: c }))
    : [];

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    list = filterItems(list, search, ['Nombre', 'nombre', 'Documento', 'Correo', 'correo', 'Contacto', 'contacto']);
    return sortByStatus(list);
  })();

  const openCreate = () => { setFormData(EMPTY); setEditingId(null); setFormError(''); reset(); setShowForm(true); };
  const openEdit = (item) => {
    setFormData({
      TipoProveedor: item.TipoProveedor || '',
      Documento: item.Documento || '',
      nombre: item.nombre || '',
      correo: item.correo || '',
      contacto: item.contacto || '',
      departamento: item.departamento || '',
      ciudad: item.ciudad || '',
      direccion: item.direccion || '',
      detalles: item.detalles || '',
    });
    setEditingId(item.Id_Proveedor); setFormError(''); reset(); setShowForm(true);
  };
  const setField = (name, value, extra = {}) => {
    const next = { ...formData, [name]: value, ...extra };
    setFormData(next);
    if (touched[name] || errors[name]) revalidate(next);
  };
  const handleChange = (e) => setField(e.target.name, e.target.value);
  const handleBlur = (e) => { markTouched(e.target.name); revalidate(formData); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateNow(formData);
    setErrors(errs); touchAll();
    if (V.hasErrors(errs)) { setFormError('Corrige los campos marcados antes de guardar.'); return; }
    setFormError('');
    const action = editingId ? updateProveedor({ id: editingId, data: formData }) : createProveedor(formData);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); dispatch(fetchProveedores()); }
    else setFormError(result.payload || 'No se pudo guardar el proveedor.');
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Nombre', label: 'Nombre', render: (v, row) => <span className="font-medium">{v || row.nombre}</span> },
    { key: 'Documento', label: 'Documento' },
    { key: 'TipoProveedor', label: 'Tipo' },
    { key: 'contacto', label: 'Contacto', render: (v, row) => v || row.Contacto || '—' },
    { key: 'correo', label: 'Correo', render: (v, row) => v || row.Correo || '—' },
    { key: 'Estado', label: 'Estado', render: v => <StatusBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setDetailItem(row)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" disabled={!puedeEditar} onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleProveedorEstado({ id: row.Id_Proveedor, Estado: row.Estado === 1 ? 0 : 1 }))} disabled={!puedeToggle} />
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Proveedores</h1><p className="page__subtitle">{items.length} proveedor(es) registrado(s)</p></div>
        <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nuevo proveedor</button>
      </div>
      <div className="card">
        <div className="card__header">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, documento, contacto..."
            filterSlot={<FilterDropdown statusFilter={statusFilter} onStatusChange={setStatusFilter} pageSize={pageSize} onPageSizeChange={setPageSize} />}
          />
        </div>
        <Table columns={columns} data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron proveedores" />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Detalle del proveedor" size="md">
        {detailItem && <div className="detail-grid">
          <div className="detail-item"><span className="detail-label">Nombre</span><span className="detail-value">{detailItem.Nombre || detailItem.nombre}</span></div>
          <div className="detail-item"><span className="detail-label">Tipo</span><span className="detail-value">{detailItem.TipoProveedor || '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Documento</span><span className="detail-value">{detailItem.Documento || '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Contacto</span><span className="detail-value">{detailItem.contacto || detailItem.Contacto || '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Correo</span><span className="detail-value">{detailItem.correo || detailItem.Correo || '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Departamento</span><span className="detail-value">{detailItem.departamento || '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Ciudad</span><span className="detail-value">{detailItem.ciudad || '—'}</span></div>
          <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Dirección</span><span className="detail-value">{detailItem.direccion || '—'}</span></div>
          {detailItem.detalles && (
            <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Detalles</span><span className="detail-value">{detailItem.detalles}</span></div>
          )}
          <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><StatusBadge estado={detailItem.Estado} /></span></div>
        </div>}
      </Modal>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar proveedor' : 'Nuevo proveedor'} size="lg"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading || isInvalid(formData)}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Tipo de proveedor <span className="required">*</span></label>
            <select name="TipoProveedor" className={`form-control ${fieldError('TipoProveedor') ? 'is-error' : ''}`} value={formData.TipoProveedor} onChange={handleChange} onBlur={handleBlur}>
              <option value="">Seleccionar...</option>
              <option value="Natural">Natural</option>
              <option value="Juridico">Jurídico</option>
            </select>
            {fieldError('TipoProveedor') && <p className="form-error">{fieldError('TipoProveedor')}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Documento <span className="required">*</span></label>
            <input name="Documento" className={`form-control ${fieldError('Documento') ? 'is-error' : ''}`} value={formData.Documento} onChange={handleChange} onBlur={handleBlur} inputMode="numeric" placeholder="Número de documento o NIT" />
            {fieldError('Documento') && <p className="form-error">{fieldError('Documento')}</p>}
          </div>
          <div className="form-group span-2">
            <label className="form-label">Nombre <span className="required">*</span></label>
            <input name="nombre" className={`form-control ${fieldError('nombre') ? 'is-error' : ''}`} value={formData.nombre} onChange={handleChange} onBlur={handleBlur} placeholder="Nombre del proveedor o empresa" />
            {fieldError('nombre') && <p className="form-error">{fieldError('nombre')}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Contacto</label>
            <input name="contacto" className="form-control" value={formData.contacto} onChange={handleChange} placeholder="Teléfono o persona de contacto" />
          </div>
          <div className="form-group">
            <label className="form-label">Correo</label>
            <input name="correo" type="email" className={`form-control ${fieldError('correo') ? 'is-error' : ''}`} value={formData.correo} onChange={handleChange} onBlur={handleBlur} placeholder="correo@proveedor.com" />
            {fieldError('correo') && <p className="form-error">{fieldError('correo')}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Departamento</label>
            <SearchableSelect
              options={DEPARTAMENTOS}
              value={formData.departamento}
              onChange={v => setFormData(p => ({ ...p, departamento: v, ciudad: '' }))}
              placeholder="Seleccionar departamento..."
              labelKey="label"
              valueKey="value"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Ciudad</label>
            <SearchableSelect
              options={ciudadesOpts}
              value={formData.ciudad}
              onChange={v => setFormData(p => ({ ...p, ciudad: v }))}
              placeholder={formData.departamento ? 'Seleccionar ciudad...' : 'Primero selecciona departamento'}
              labelKey="label"
              valueKey="value"
              disabled={!formData.departamento}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Dirección</label>
            <input name="direccion" className="form-control" value={formData.direccion} onChange={handleChange} placeholder="Dirección" />
          </div>
          <div className="form-group span-2">
            <label className="form-label">Detalles</label>
            <textarea name="detalles" className="form-control" value={formData.detalles} onChange={handleChange} rows={2} placeholder="Información adicional..." />
          </div>
        </form>
      </Modal>
    </div>
  );
}
