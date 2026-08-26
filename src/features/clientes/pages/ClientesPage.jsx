import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit, MdVisibilityOff, MdDeleteForever, MdSwapHoriz } from 'react-icons/md';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import { useBorradoReal } from '../../../shared/hooks/useBorradoReal.js';
import { useToast } from '../../../shared/components/Toast/ToastContext.jsx';
import { clientesService } from '../services/clientesService.js';
import ImageUploader from '../../../shared/components/ImageUploader/ImageUploader.jsx';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import EliminarRealModal from '../../../shared/components/EliminarRealModal/EliminarRealModal.jsx';
import ConvertirAEmpleadoModal from '../components/ConvertirAEmpleadoModal.jsx';
import { fetchClientes, createCliente, updateCliente, toggleClienteEstado } from '../slices/clientesSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import Badge, { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import { sortByStatus, sortNewestFirst, filterItems } from '../../../shared/utils/helpers.js';
import * as V from '../../../shared/utils/validators.js';
import api from '../../../shared/services/api.js';
import './ClientesPage.css';

const EMPTY_FORM = { Nombre: '', Id_TipoDoc: '', Documento: '', Telefono: '', Direccion: '', Correo: '', Foto: '', Password: '', ConfirmPassword: '' };

export default function ClientesPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector((s) => s.clientes);
  const puedeCrear   = usePermiso('CLIENTES.REGISTRAR');
  const puedeEditar  = usePermiso('CLIENTES.EDITAR');
  const puedeToggle  = usePermiso('CLIENTES.CAMBIAR_ESTADO');
  const esSuperadmin = useSelector((s) => s.auth.empleado?.EsSuperAdmin === true);
  const del = useBorradoReal(clientesService, {
    entidadLabel: 'cliente',
    onDeleted: () => dispatch(fetchClientes()),
  });
  const { addToast } = useToast();
  const [showConvertir, setShowConvertir] = useState(false);
  const [tiposDoc, setTiposDoc] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize] = useState(5);
  const [detailId, setDetailId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [fotoPreview, setFotoPreview] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    dispatch(fetchClientes());
    api.get('/api/catalogos/tipos-documento').then(r => setTiposDoc(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/roles').then(r => setRoles(r.data?.data || r.data || [])).catch(() => {});
  }, [dispatch]);

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    list = filterItems(list, search, ['Nombre', 'Documento', 'Correo', 'Telefono']);
    return sortByStatus(sortNewestFirst(list, 'Id_Cliente'));
  })();

  // Derivado de `items` en cada render (no un snapshot congelado): así el modal de
  // detalle refleja en tiempo real los cambios de Estado hechos desde la tabla.
  const detailItem = detailId ? items.find(i => i.Id_Cliente === detailId) || null : null;

  const tiposDocOpts = tiposDoc.map(t => ({ value: String(t.Id_TipoDoc), label: t.Nombre }));

  // Mini-resumen: conteos sobre el total (no sobre la vista filtrada).
  const resumen = useMemo(() => {
    const activos = items.filter(i => i.Estado !== 0).length;
    return { activos, inactivos: items.length - activos, total: items.length };
  }, [items]);

  // Reglas de validación (las de contraseña solo aplican al crear).
  const rules = useMemo(() => {
    const r = {
      Id_TipoDoc: (v) => V.requiredSelect(v, 'El tipo de documento'),
      Documento:  V.documento,
      Nombre:     (v) => V.nombre(v, 3, 100),
      Telefono:   (v) => V.telefono(v, false),
      Direccion:  (v) => V.maxLen(v, 150, 'La dirección'),
      Correo:     (v) => V.correo(v, true) || V.maxLen(v, 120, 'El correo'),
    };
    if (!editingId) {
      r.Password = V.passwordFuerte;
      r.ConfirmPassword = (v, all) => V.confirmarPassword(v, all.Password);
    }
    return r;
  }, [editingId]);

  const { errors, touched, setErrors, revalidate, markTouched, touchAll, fieldError, isInvalid, validateNow, reset } = useFormValidation(rules);
  const formInvalid = isInvalid(formData);

  const resetForm = () => { reset(); setFormError(''); setShowPassword(false); setShowConfirm(false); };

  const openCreate = () => {
    setFormData(EMPTY_FORM); setEditingId(null); setFotoPreview(null); resetForm();
    setShowForm(true);
  };

  const openEdit = (item) => {
    setFormData({
      Nombre: item.Nombre || '', Id_TipoDoc: String(item.Id_TipoDoc || ''),
      Documento: item.Documento || '', Telefono: item.Telefono || '',
      Direccion: item.Direccion || '',
      Correo: item.Correo || '', Foto: item.Foto || '', Password: '', ConfirmPassword: '',
    });
    setFotoPreview(item.Foto || null);
    setEditingId(item.Id_Cliente); resetForm(); setShowForm(true);
  };

  const setField = (name, value) => {
    const next = { ...formData, [name]: value };
    setFormData(next);
    if (touched[name] || errors[name] || name === 'ConfirmPassword' || name === 'Password') {
      revalidate(next);
    }
  };

  const handleFormChange = (e) => setField(e.target.name, e.target.value);
  const handleBlur = (e) => {
    markTouched(e.target.name);
    revalidate(formData);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const errs = validateNow(formData);
    setErrors(errs);
    touchAll();
    if (V.hasErrors(errs)) { setFormError('Corrige los campos marcados antes de guardar.'); return; }
    setFormError('');

    // Payload: sin ConfirmPassword ni Direccion. En edición NO se envía Password.
    const payload = {
      Id_TipoDoc: formData.Id_TipoDoc,
      Documento:  formData.Documento.trim(),
      Nombre:     formData.Nombre.trim(),
      Telefono:   formData.Telefono.trim(),
      Direccion:  formData.Direccion.trim(),
      Correo:     formData.Correo.trim(),
      Foto:       formData.Foto,
    };
    if (!editingId) payload.Password = formData.Password;

    const action = editingId ? updateCliente({ id: editingId, data: payload }) : createCliente(payload);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); dispatch(fetchClientes()); }
    else setFormError(result.payload || 'No se pudo guardar el cliente.');
  };

  const handleToggle = (item) => {
    dispatch(toggleClienteEstado({ id: item.Id_Cliente, Estado: item.Estado === 1 ? 0 : 1 }));
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    {
      key: 'Nombre', label: 'Nombre', render: (v, row) => (
        <div className="cell-user">
          {row.Foto
            ? <img src={row.Foto} alt="" className="cell-user__avatar" />
            : <div className="cell-user__avatar cell-user__avatar--initial">{v?.charAt(0)}</div>}
          <span className="font-medium">{v}</span>
        </div>
      )
    },
    { key: 'Documento', label: 'Documento' },
    { key: 'Telefono', label: 'Teléfono' },
    { key: 'Correo', label: 'Correo' },
    { key: 'Estado', label: 'Estado', render: (v) => <StatusBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" title="Ver detalle" onClick={() => setDetailId(row.Id_Cliente)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" title="Editar" disabled={!puedeEditar} onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          <ToggleSwitch checked={row.Estado === 1} onChange={() => handleToggle(row)} disabled={!puedeToggle} />
          {esSuperadmin && (
            <button className="btn btn--ghost btn--icon btn--sm btn--danger-ghost" title="Eliminar definitivamente" onClick={() => del.open(row.Id_Cliente)}><MdDeleteForever size={17} /></button>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Clientes</h1>
          <p className="page__subtitle">{items.length} cliente(s) registrado(s)</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nuevo cliente</button>
      </div>

      <div className="card">
        <div className="card__header">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, documento, correo..."
            filterSlot={
              <FilterDropdown statusFilter={statusFilter} onStatusChange={setStatusFilter} pageSize={pageSize} onPageSizeChange={setPageSize} />
            }
          />
        </div>
        {!loading && items.length > 0 && (
          <div className="table-summary">
            <Badge variant="success">{resumen.activos} activos</Badge>
            <Badge variant="gray">{resumen.inactivos} inactivos</Badge>
            <span className="table-summary__total">{resumen.total} en total</span>
          </div>
        )}
        <Table columns={columns} rowKey="Id_Cliente" data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron clientes" />
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!detailItem} onClose={() => setDetailId(null)} title="Detalle del cliente" size="md">
        {detailItem && (
          <div className="detail-grid">
            <div className="detail-item"><span className="detail-label">Nombre</span><span className="detail-value">{detailItem.Nombre}</span></div>
            <div className="detail-item"><span className="detail-label">Tipo de documento</span><span className="detail-value">{detailItem.TipoDoc || detailItem.Id_TipoDoc}</span></div>
            <div className="detail-item"><span className="detail-label">Documento</span><span className="detail-value">{detailItem.Documento}</span></div>
            <div className="detail-item"><span className="detail-label">Teléfono</span><span className="detail-value">{detailItem.Telefono || '—'}</span></div>
            <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Dirección</span><span className="detail-value">{detailItem.Direccion || '—'}</span></div>
            <div className="detail-item"><span className="detail-label">Correo</span><span className="detail-value">{detailItem.Correo || '—'}</span></div>
            <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><StatusBadge estado={detailItem.Estado} /></span></div>
          </div>
        )}
      </Modal>

      {/* Form Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar cliente' : 'Nuevo cliente'} size="md"
        footer={
          <>
            <button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn--primary" onClick={handleFormSubmit} disabled={actionLoading || formInvalid}>{actionLoading ? 'Guardando...' : 'Guardar'}</button>
          </>
        }
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <form className="form-grid" onSubmit={handleFormSubmit} noValidate>

          {/* Avatar (opcional) */}
          <div className="form-group span-2">
            <div className="form-avatar-row">
              <ImageUploader
                preview={fotoPreview}
                onChange={file => {
                  const reader = new FileReader();
                  reader.onload = ev => { setFotoPreview(ev.target.result); setFormData(p => ({ ...p, Foto: ev.target.result })); };
                  reader.readAsDataURL(file);
                }}
                size={60}
                initials={formData.Nombre?.charAt(0)?.toUpperCase()}
              />
              <span className="form-hint">Foto del cliente (opcional)</span>
            </div>
          </div>

          {/* 1. Tipo de documento */}
          <div className="form-group">
            <label className="form-label">Tipo de documento <span className="required">*</span></label>
            <SearchableSelect
              options={tiposDocOpts}
              value={String(formData.Id_TipoDoc)}
              onChange={v => { setField('Id_TipoDoc', v); markTouched('Id_TipoDoc'); }}
              placeholder="Seleccionar tipo..."
            />
            {fieldError('Id_TipoDoc') && <p className="form-error">{fieldError('Id_TipoDoc')}</p>}
          </div>

          {/* 2. Número de documento */}
          <div className="form-group">
            <label className="form-label">Número de documento <span className="required">*</span></label>
            <input name="Documento" className={`form-control ${fieldError('Documento') ? 'is-error' : ''}`}
              value={formData.Documento} onChange={handleFormChange} onBlur={handleBlur}
              inputMode="numeric" maxLength={10} placeholder="Solo números" />
            {fieldError('Documento') && <p className="form-error">{fieldError('Documento')}</p>}
          </div>

          {/* 3. Nombres */}
          <div className="form-group span-2">
            <label className="form-label">Nombres <span className="required">*</span></label>
            <input name="Nombre" className={`form-control ${fieldError('Nombre') ? 'is-error' : ''}`}
              value={formData.Nombre} onChange={handleFormChange} onBlur={handleBlur} maxLength={100} placeholder="Nombre completo" />
            {fieldError('Nombre') && <p className="form-error">{fieldError('Nombre')}</p>}
          </div>

          {/* 4. Teléfono */}
          <div className="form-group">
            <label className="form-label">Teléfono <span className="required">*</span></label>
            <input name="Telefono" className={`form-control ${fieldError('Telefono') ? 'is-error' : ''}`}
              value={formData.Telefono} onChange={handleFormChange} onBlur={handleBlur}
              inputMode="numeric" maxLength={10} placeholder="Teléfono de contacto" />
            {fieldError('Telefono') && <p className="form-error">{fieldError('Telefono')}</p>}
          </div>

          {/* 5. Dirección (opcional) */}
          <div className="form-group span-2">
            <label className="form-label">Dirección</label>
            <input name="Direccion" className={`form-control ${fieldError('Direccion') ? 'is-error' : ''}`}
              value={formData.Direccion} onChange={handleFormChange} onBlur={handleBlur}
              maxLength={150} placeholder="Dirección (opcional)" />
            {fieldError('Direccion') && <p className="form-error">{fieldError('Direccion')}</p>}
          </div>

          {/* 6. Correo */}
          <div className="form-group">
            <label className="form-label">Correo electrónico</label>
            <input name="Correo" type="email" className={`form-control ${fieldError('Correo') ? 'is-error' : ''}`}
              value={formData.Correo} onChange={handleFormChange} onBlur={handleBlur} maxLength={120} placeholder="correo@ejemplo.com" />
            {fieldError('Correo') && <p className="form-error">{fieldError('Correo')}</p>}
          </div>

          {/* 6. Contraseña + Confirmar (solo al crear) */}
          {!editingId && (
            <>
              <div className="form-group">
                <label className="form-label">Contraseña portal <span className="required">*</span></label>
                <div className="form-password-wrap">
                  <input name="Password" type={showPassword ? 'text' : 'password'}
                    className={`form-control ${fieldError('Password') ? 'is-error' : ''}`}
                    value={formData.Password} onChange={handleFormChange} onBlur={handleBlur}
                    placeholder="Mínimo 8, letra y número" />
                  <button type="button" className="form-password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Ocultar' : 'Mostrar'}>
                    {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                  </button>
                </div>
                {fieldError('Password') && <p className="form-error">{fieldError('Password')}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar contraseña <span className="required">*</span></label>
                <div className="form-password-wrap">
                  <input name="ConfirmPassword" type={showConfirm ? 'text' : 'password'}
                    className={`form-control ${fieldError('ConfirmPassword') ? 'is-error' : ''}`}
                    value={formData.ConfirmPassword} onChange={handleFormChange} onBlur={handleBlur}
                    placeholder="Repite la contraseña" />
                  <button type="button" className="form-password-toggle" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? 'Ocultar' : 'Mostrar'}>
                    {showConfirm ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                  </button>
                </div>
                {fieldError('ConfirmPassword') && <p className="form-error">{fieldError('ConfirmPassword')}</p>}
              </div>
            </>
          )}

          {editingId && esSuperadmin && (
            <div className="form-group span-2 convertir-box">
              <div className="convertir-box__head"><MdSwapHoriz size={17} /> Convertir en empleado</div>
              <p className="convertir-box__intro">
                Da de baja a este cliente y crea una cuenta de empleado con sus mismos datos.
                Requiere confirmación por texto y no se puede deshacer.
              </p>
              <button type="button" className="btn btn--outline" onClick={() => setShowConvertir(true)}>
                <MdSwapHoriz size={16} /> Convertir a empleado…
              </button>
            </div>
          )}
        </form>
      </Modal>

      <ConvertirAEmpleadoModal
        isOpen={showConvertir}
        onClose={() => setShowConvertir(false)}
        cliente={editingId ? items.find(i => i.Id_Cliente === editingId) : null}
        roles={roles}
        onSuccess={() => {
          setShowConvertir(false);
          setShowForm(false);
          addToast({ type: 'success', message: 'Cliente convertido en empleado correctamente.' });
          dispatch(fetchClientes());
        }}
      />

      <EliminarRealModal
        isOpen={del.isOpen}
        onClose={del.close}
        entidadLabel="cliente"
        preview={del.preview}
        loadingPreview={del.loadingPreview}
        deleting={del.deleting}
        error={del.error}
        onConfirm={del.confirm}
      />
    </div>
  );
}
