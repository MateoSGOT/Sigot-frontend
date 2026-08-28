import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit, MdDeleteForever } from 'react-icons/md';
import { useBorradoReal } from '../../../shared/hooks/useBorradoReal.js';
import { serviciosService } from '../services/serviciosService.js';
import EliminarRealModal from '../../../shared/components/EliminarRealModal/EliminarRealModal.jsx';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchServicios, createServicio, updateServicio, toggleServicioEstado } from '../slices/serviciosSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { sortByStatus, sortNewestFirst, filterItems, formatCurrency } from '../../../shared/utils/helpers.js';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import './ServiciosPage.css';

const EMPTY = { Nombre: '', Descripcion: '', Precio: '', DuracionMinutos: '' };
const RULES = {
  Nombre: (v) => V.nombre(v, 3, 80),
  Descripcion: (v) => V.maxLen(v, 200, 'La descripción'),
  Precio: (v) => V.numeroPositivo(v, 'El precio'),
  // Opcional: si se llena, entero >= 1.
  DuracionMinutos: (v) => {
    if (v == null || String(v).trim() === '') return '';
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) return 'La duración debe ser un entero de al menos 1 minuto.';
    return '';
  },
};

export default function ServiciosPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.servicios);
  const puedeCrear   = usePermiso('SERVICIOS.REGISTRAR');
  const puedeEditar  = usePermiso('SERVICIOS.EDITAR');
  const puedeToggle  = usePermiso('SERVICIOS.CAMBIAR_ESTADO');
  const esSuperadmin = useSelector(s => s.auth.empleado?.EsSuperAdmin === true);
  const del = useBorradoReal(serviciosService, { entidadLabel: 'servicio', onDeleted: () => dispatch(fetchServicios()) });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize] = useState(5);
  const [detailItem, setDetailItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const { errors, touched, setErrors, revalidate, markTouched, touchAll, fieldError, isInvalid, validateNow, reset } = useFormValidation(RULES);

  useEffect(() => { dispatch(fetchServicios()); }, [dispatch]);

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    list = filterItems(list, search, ['Nombre', 'Descripcion']);
    return sortByStatus(sortNewestFirst(list, 'Id_Servicio'));
  })();

  const openCreate = () => { setFormData(EMPTY); setEditingId(null); setFormError(''); reset(); setShowForm(true); };
  const openEdit = (item) => { setFormData({ Nombre: item.Nombre || '', Descripcion: item.Descripcion || '', Precio: item.Precio || '', DuracionMinutos: item.DuracionMinutos ?? '' }); setEditingId(item.Id_Servicio); setFormError(''); reset(); setShowForm(true); };
  const handleChange = (e) => {
    const next = { ...formData, [e.target.name]: e.target.value };
    setFormData(next);
    if (touched[e.target.name] || errors[e.target.name]) revalidate(next);
  };
  const handleBlur = (e) => { markTouched(e.target.name); revalidate(formData); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateNow(formData);
    setErrors(errs); touchAll();
    if (V.hasErrors(errs)) { setFormError('Corrige los campos marcados antes de guardar.'); return; }
    setFormError('');
    const dur = String(formData.DuracionMinutos ?? '').trim();
    const payload = {
      Nombre: formData.Nombre,
      Descripcion: formData.Descripcion,
      Precio: formData.Precio,
      DuracionMinutos: dur === '' ? null : Number(dur),
    };
    const action = editingId ? updateServicio({ id: editingId, data: payload }) : createServicio(payload);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); dispatch(fetchServicios()); }
    else setFormError(result.payload || 'No se pudo guardar el servicio.');
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Nombre', label: 'Nombre', render: v => <span className="font-medium">{v}</span> },
    { key: 'Descripcion', label: 'Descripción', render: v => <span className="descripcion-cell">{v || '—'}</span> },
    { key: 'Precio', label: 'Precio', render: v => formatCurrency(v) },
    { key: 'DuracionMinutos', label: 'Duración', render: v => (v ? `${v} min` : '—') },
    { key: 'Estado', label: 'Estado', render: v => <StatusBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleServicioEstado({ id: row.Id_Servicio, Estado: row.Estado === 1 ? 0 : 1 }))} disabled={!puedeToggle} />
          <button className="btn btn--ghost btn--icon btn--sm" title="Ver" onClick={() => setDetailItem(row)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" title="Editar" disabled={!puedeEditar} onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          {esSuperadmin && (
            <button className="btn btn--ghost btn--icon btn--sm btn--danger-ghost" title="Eliminar definitivamente" onClick={() => del.open(row.Id_Servicio)}><MdDeleteForever size={17} /></button>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Servicios</h1><p className="page__subtitle">{items.length} servicio(s) disponible(s)</p></div>
        <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nuevo servicio</button>
      </div>
      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre, descripción..."
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
        <Table columns={columns} rowKey="Id_Servicio" data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron servicios" />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Detalle del servicio" size="md">
        {detailItem && <div className="detail-grid">
          <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Nombre</span><span className="detail-value">{detailItem.Nombre}</span></div>
          <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Descripción</span><span className="detail-value">{detailItem.Descripcion || '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Precio</span><span className="detail-value">{formatCurrency(detailItem.Precio)}</span></div>
          <div className="detail-item"><span className="detail-label">Duración</span><span className="detail-value">{detailItem.DuracionMinutos ? `${detailItem.DuracionMinutos} min` : '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><StatusBadge estado={detailItem.Estado} /></span></div>
        </div>}
      </Modal>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar servicio' : 'Nuevo servicio'} size="md"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading || isInvalid(formData)}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="form-group span-2"><label className="form-label">Nombre <span className="required">*</span></label>
            <input name="Nombre" className={`form-control ${fieldError('Nombre') ? 'is-error' : ''}`} value={formData.Nombre} onChange={handleChange} onBlur={handleBlur} maxLength={80} placeholder="Nombre del servicio" />
            {fieldError('Nombre') && <p className="form-error">{fieldError('Nombre')}</p>}
          </div>
          <div className="form-group span-2"><label className="form-label">Descripción</label>
            <textarea name="Descripcion" className={`form-control ${fieldError('Descripcion') ? 'is-error' : ''}`} value={formData.Descripcion} onChange={handleChange} onBlur={handleBlur} rows={3} maxLength={200} placeholder="Describe el servicio..." />
            {fieldError('Descripcion') && <p className="form-error">{fieldError('Descripcion')}</p>}
          </div>
          <div className="form-group"><label className="form-label">Precio <span className="required">*</span></label>
            <input name="Precio" type="number" min="0" step="0.01" className={`form-control ${fieldError('Precio') ? 'is-error' : ''}`} value={formData.Precio} onChange={handleChange} onBlur={handleBlur} placeholder="0" />
            {fieldError('Precio') && <p className="form-error">{fieldError('Precio')}</p>}
          </div>
          <div className="form-group"><label className="form-label">Duración (minutos)</label>
            <input name="DuracionMinutos" type="number" min="1" step="1" className={`form-control ${fieldError('DuracionMinutos') ? 'is-error' : ''}`} value={formData.DuracionMinutos} onChange={handleChange} onBlur={handleBlur} placeholder="Opcional (ej. 45)" />
            {fieldError('DuracionMinutos') && <p className="form-error">{fieldError('DuracionMinutos')}</p>}
          </div>
        </form>
      </Modal>

      <EliminarRealModal isOpen={del.isOpen} onClose={del.close} entidadLabel="servicio"
        preview={del.preview} loadingPreview={del.loadingPreview} deleting={del.deleting} error={del.error} onConfirm={del.confirm} />
    </div>
  );
}

