import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit, MdDeleteForever } from 'react-icons/md';
import { useBorradoReal } from '../../../shared/hooks/useBorradoReal.js';
import { proveedoresService } from '../services/proveedoresService.js';
import EliminarRealModal from '../../../shared/components/EliminarRealModal/EliminarRealModal.jsx';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchProveedores, createProveedor, updateProveedor, toggleProveedorEstado } from '../slices/proveedoresSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { sortByStatus, sortNewestFirst, filterItems } from '../../../shared/utils/helpers.js';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import { MUNICIPIOS_POR_DEPARTAMENTO } from '../../../shared/data/colombiaGeo.js';
import './ProveedoresPage.css';

const DEPARTAMENTOS = Object.keys(MUNICIPIOS_POR_DEPARTAMENTO).sort().map(d => ({ label: d, value: d }));

const EMPTY = {
  TipoProveedor: '', Documento: '', nombre: '', correo: '', contacto: '', departamento: '', ciudad: '', direccion: '', detalles: '',
  Representante: '', RepresentanteDocumento: '', RepresentanteTelefono: '', RepresentanteCorreo: '',
};
// Documento condicional según el tipo: Jurídico -> NIT (9-10), Natural -> Cédula (6-10).
const documentoPorTipo = (v, values = {}) => {
  const esJuridico = values.TipoProveedor === 'Juridico';
  const label = esJuridico ? 'El NIT' : 'La cédula';
  const s = String(v ?? '').trim();
  if (!s) return `${label === 'El NIT' ? 'El NIT es obligatorio' : 'La cédula es obligatoria'}.`;
  if (!/^\d+$/.test(s)) return `${label} solo puede contener números.`;
  const [min, max] = esJuridico ? [9, 10] : [6, 10];
  if (s.length < min || s.length > max) return `${label} debe tener entre ${min} y ${max} dígitos.`;
  return '';
};
// Representante legal: obligatorio SOLO cuando TipoProveedor = "Juridico" (el backend lo
// rechaza si se envía para "Natural"). Para "Natural"/sin elegir, no valida nada.
const representanteDocumento = (v, values = {}) => {
  if (values.TipoProveedor !== 'Juridico') return '';
  const s = String(v ?? '').trim();
  if (!s) return 'El documento del representante es obligatorio.';
  if (!/^\d+$/.test(s)) return 'El documento del representante solo puede contener números.';
  if (s.length < 6 || s.length > 10) return 'El documento del representante debe tener entre 6 y 10 dígitos.';
  return '';
};
const representanteRequerido = (label) => (v, values = {}) => {
  if (values.TipoProveedor !== 'Juridico') return '';
  return V.isBlank(v) ? `${label} es obligatorio.` : '';
};
const RULES = {
  TipoProveedor: (v) => V.requiredSelect(v, 'El tipo de proveedor'),
  Documento:     documentoPorTipo,
  nombre:        (v) => V.nombre(v, 3, 120),
  correo:        (v) => V.correo(v, true) || V.maxLen(v, 120, 'El correo'),
  contacto:      (v) => V.maxLen(v, 20, 'El contacto'),
  direccion:     (v) => V.maxLen(v, 150, 'La dirección'),
  detalles:      (v) => V.maxLen(v, 200, 'Los detalles'),
  Representante:          representanteRequerido('El nombre del representante'),
  RepresentanteDocumento: representanteDocumento,
  RepresentanteTelefono:  representanteRequerido('El teléfono del representante'),
  RepresentanteCorreo:    (v, values = {}) => (values.TipoProveedor === 'Juridico' ? (V.correo(v, false) || V.maxLen(v, 120, 'El correo del representante')) : ''),
};

export default function ProveedoresPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.proveedores);
  const puedeCrear   = usePermiso('PROVEEDORES.REGISTRAR');
  const puedeEditar  = usePermiso('PROVEEDORES.EDITAR');
  const puedeToggle  = usePermiso('PROVEEDORES.CAMBIAR_ESTADO');
  const esSuperadmin = useSelector(s => s.auth.empleado?.EsSuperAdmin === true);
  const del = useBorradoReal(proveedoresService, { entidadLabel: 'proveedor', onDeleted: () => dispatch(fetchProveedores()) });
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

  // Etiquetas/placeholder del documento y del nombre según el tipo de proveedor.
  const esJuridico  = formData.TipoProveedor === 'Juridico';
  const esNatural   = formData.TipoProveedor === 'Natural';
  const docLabel    = esJuridico ? 'NIT' : esNatural ? 'Cédula' : 'Documento';
  const docHint     = esJuridico ? 'NIT (9 a 10 dígitos)' : esNatural ? 'Cédula (6 a 10 dígitos)' : 'Número de documento o NIT';
  const nombreLabel = esJuridico ? 'Razón social' : esNatural ? 'Nombre completo' : 'Nombre';
  const nombreHint  = esJuridico ? 'Razón social de la empresa' : esNatural ? 'Nombre completo' : 'Nombre del proveedor o empresa';

  const ciudadesOpts = formData.departamento
    ? (MUNICIPIOS_POR_DEPARTAMENTO[formData.departamento] || []).map(c => ({ label: c, value: c }))
    : [];

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    list = filterItems(list, search, ['Nombre', 'nombre', 'Documento', 'Correo', 'correo', 'Contacto', 'contacto']);
    return sortByStatus(sortNewestFirst(list, 'Id_Proveedor'));
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
      Representante: item.Representante || '',
      RepresentanteDocumento: item.RepresentanteDocumento || '',
      RepresentanteTelefono: item.RepresentanteTelefono || '',
      RepresentanteCorreo: item.RepresentanteCorreo || '',
    });
    setEditingId(item.Id_Proveedor); setFormError(''); reset(); setShowForm(true);
  };
  const setField = (name, value, extra = {}) => {
    const next = { ...formData, [name]: value, ...extra };
    setFormData(next);
    // Al cambiar el tipo, revalida el documento con la nueva regla (etiquetas/validación en caliente).
    if (name === 'TipoProveedor') { revalidate(next); return; }
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
    // El backend rechaza (400) los campos de Representante si TipoProveedor no es "Juridico":
    // no alcanza con dejarlos vacíos, hay que omitirlos del payload por completo.
    const payload = { ...formData };
    if (formData.TipoProveedor !== 'Juridico') {
      delete payload.Representante;
      delete payload.RepresentanteDocumento;
      delete payload.RepresentanteTelefono;
      delete payload.RepresentanteCorreo;
    }
    const action = editingId ? updateProveedor({ id: editingId, data: payload }) : createProveedor(payload);
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
          <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleProveedorEstado({ id: row.Id_Proveedor, Estado: row.Estado === 1 ? 0 : 1 }))} disabled={!puedeToggle} />
          <button className="btn btn--ghost btn--icon btn--sm" title="Ver" onClick={() => setDetailItem(row)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" title="Editar" disabled={!puedeEditar} onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          {esSuperadmin && (
            <button className="btn btn--ghost btn--icon btn--sm btn--danger-ghost" title="Eliminar definitivamente" onClick={() => del.open(row.Id_Proveedor)}><MdDeleteForever size={17} /></button>
          )}
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
        <Table columns={columns} rowKey="Id_Proveedor" data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron proveedores" />
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
          {detailItem.TipoProveedor === 'Juridico' && (
            <>
              <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label representante-section__title">Representante legal</span></div>
              <div className="detail-item"><span className="detail-label">Nombre</span><span className="detail-value">{detailItem.Representante || '—'}</span></div>
              <div className="detail-item"><span className="detail-label">Documento</span><span className="detail-value">{detailItem.RepresentanteDocumento || '—'}</span></div>
              <div className="detail-item"><span className="detail-label">Teléfono</span><span className="detail-value">{detailItem.RepresentanteTelefono || '—'}</span></div>
              <div className="detail-item"><span className="detail-label">Correo</span><span className="detail-value">{detailItem.RepresentanteCorreo || '—'}</span></div>
            </>
          )}
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
            <label className="form-label">{docLabel} <span className="required">*</span></label>
            <input name="Documento" className={`form-control ${fieldError('Documento') ? 'is-error' : ''}`} value={formData.Documento} onChange={handleChange} onBlur={handleBlur} inputMode="numeric" maxLength={10} placeholder={docHint} />
            {fieldError('Documento') && <p className="form-error">{fieldError('Documento')}</p>}
          </div>
          <div className="form-group span-2">
            <label className="form-label">{nombreLabel} <span className="required">*</span></label>
            <input name="nombre" className={`form-control ${fieldError('nombre') ? 'is-error' : ''}`} value={formData.nombre} onChange={handleChange} onBlur={handleBlur} maxLength={120} placeholder={nombreHint} />
            {fieldError('nombre') && <p className="form-error">{fieldError('nombre')}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Contacto</label>
            <input name="contacto" className={`form-control ${fieldError('contacto') ? 'is-error' : ''}`} value={formData.contacto} onChange={handleChange} onBlur={handleBlur} maxLength={20} placeholder="Teléfono o persona de contacto" />
            {fieldError('contacto') && <p className="form-error">{fieldError('contacto')}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Correo</label>
            <input name="correo" type="email" className={`form-control ${fieldError('correo') ? 'is-error' : ''}`} value={formData.correo} onChange={handleChange} onBlur={handleBlur} maxLength={120} placeholder="correo@proveedor.com" />
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
            <input name="direccion" className={`form-control ${fieldError('direccion') ? 'is-error' : ''}`} value={formData.direccion} onChange={handleChange} onBlur={handleBlur} maxLength={150} placeholder="Dirección" />
            {fieldError('direccion') && <p className="form-error">{fieldError('direccion')}</p>}
          </div>
          <div className="form-group span-2">
            <label className="form-label">Detalles</label>
            <textarea name="detalles" className={`form-control ${fieldError('detalles') ? 'is-error' : ''}`} value={formData.detalles} onChange={handleChange} onBlur={handleBlur} rows={2} maxLength={200} placeholder="Información adicional..." />
            {fieldError('detalles') && <p className="form-error">{fieldError('detalles')}</p>}
          </div>

          {esJuridico && (
            <>
              <div className="form-group span-2 representante-section">
                <span className="representante-section__title">Representante legal</span>
              </div>
              <div className="form-group span-2">
                <label className="form-label">Nombre del representante <span className="required">*</span></label>
                <input name="Representante" className={`form-control ${fieldError('Representante') ? 'is-error' : ''}`} value={formData.Representante} onChange={handleChange} onBlur={handleBlur} maxLength={120} placeholder="Nombre completo del representante" />
                {fieldError('Representante') && <p className="form-error">{fieldError('Representante')}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Documento del representante <span className="required">*</span></label>
                <input name="RepresentanteDocumento" className={`form-control ${fieldError('RepresentanteDocumento') ? 'is-error' : ''}`} value={formData.RepresentanteDocumento} onChange={handleChange} onBlur={handleBlur} inputMode="numeric" maxLength={10} placeholder="Cédula (6 a 10 dígitos)" />
                {fieldError('RepresentanteDocumento') && <p className="form-error">{fieldError('RepresentanteDocumento')}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono del representante <span className="required">*</span></label>
                <input name="RepresentanteTelefono" className={`form-control ${fieldError('RepresentanteTelefono') ? 'is-error' : ''}`} value={formData.RepresentanteTelefono} onChange={handleChange} onBlur={handleBlur} maxLength={20} placeholder="Teléfono de contacto" />
                {fieldError('RepresentanteTelefono') && <p className="form-error">{fieldError('RepresentanteTelefono')}</p>}
              </div>
              <div className="form-group span-2">
                <label className="form-label">Correo del representante <span className="required">*</span></label>
                <input name="RepresentanteCorreo" type="email" className={`form-control ${fieldError('RepresentanteCorreo') ? 'is-error' : ''}`} value={formData.RepresentanteCorreo} onChange={handleChange} onBlur={handleBlur} maxLength={120} placeholder="correo@representante.com" />
                {fieldError('RepresentanteCorreo') && <p className="form-error">{fieldError('RepresentanteCorreo')}</p>}
              </div>
            </>
          )}
        </form>
      </Modal>

      <EliminarRealModal isOpen={del.isOpen} onClose={del.close} entidadLabel="proveedor"
        preview={del.preview} loadingPreview={del.loadingPreview} deleting={del.deleting} error={del.error} onConfirm={del.confirm} />
    </div>
  );
}
