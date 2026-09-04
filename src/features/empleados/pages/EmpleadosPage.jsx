import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit, MdWarning, MdVisibilityOff, MdCheck, MdDeleteForever, MdSwapHoriz } from 'react-icons/md';
import { useToast } from '../../../shared/components/Toast/ToastContext.jsx';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import { useBorradoReal } from '../../../shared/hooks/useBorradoReal.js';
import { empleadosService } from '../services/empleadosService.js';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import EliminarRealModal from '../../../shared/components/EliminarRealModal/EliminarRealModal.jsx';
import ConvertirAClienteModal from '../components/ConvertirAClienteModal.jsx';
import { fetchEmpleados, createEmpleado, updateEmpleado, toggleEmpleadoEstado, deleteEmpleado } from '../slices/empleadosSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import ConfirmDialog from '../../../shared/components/ConfirmDialog/ConfirmDialog.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import Badge from '../../../shared/components/Badge/Badge.jsx';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import ImageUploader from '../../../shared/components/ImageUploader/ImageUploader.jsx';
import { sortByStatus, sortNewestFirst, filterItems, formatDate } from '../../../shared/utils/helpers.js';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import api from '../../../shared/services/api.js';
import './EmpleadosPage.css';

const EMPTY = { Nombre: '', Id_TipoDoc: '', Documento: '', Id_Rol: '', Correo: '', Password: '', ConfirmPassword: '' };

export default function EmpleadosPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.empleados);
  const puedeCrear   = usePermiso('EMPLEADOS.REGISTRAR');
  const puedeEditar  = usePermiso('EMPLEADOS.EDITAR');
  const puedeToggle  = usePermiso('EMPLEADOS.CAMBIAR_ESTADO');
  const esSuperadmin = useSelector(s => s.auth.empleado?.EsSuperAdmin === true);
  const del = useBorradoReal(empleadosService, { entidadLabel: 'empleado', onDeleted: () => dispatch(fetchEmpleados()) });
  const { addToast } = useToast();
  // Estado de la vía "Reasignar y eliminar" (dentro del modal de bloqueo).
  const [reasignarDestino, setReasignarDestino] = useState('');
  const [reasignarTexto, setReasignarTexto]     = useState('');
  const [reasignarLoading, setReasignarLoading] = useState(false);
  const [reasignarError, setReasignarError]     = useState('');
  useEffect(() => {
    setReasignarDestino(''); setReasignarTexto(''); setReasignarError(''); setReasignarLoading(false);
  }, [del.isOpen, del.preview?.id]);

  const handleReasignar = async () => {
    if (!reasignarDestino) { setReasignarError('Elige un empleado destino.'); return; }
    if (reasignarTexto.trim() !== del.preview?.textoConfirmacion) {
      setReasignarError(`Para confirmar, escribe exactamente: ${del.preview?.textoConfirmacion}`); return;
    }
    setReasignarLoading(true); setReasignarError('');
    try {
      await empleadosService.reasignarYEliminar(del.preview.id, Number(reasignarDestino), reasignarTexto.trim());
      addToast({ type: 'success', message: 'Empleado reasignado y eliminado correctamente.' });
      del.close();
      dispatch(fetchEmpleados());
    } catch (e) {
      setReasignarError(e?.response?.data?.message || 'No se pudo reasignar y eliminar.');
      setReasignarLoading(false);
    }
  };
  const [tiposDoc, setTiposDoc] = useState([]);
  const [roles, setRoles] = useState([]);
  const [novedades, setNovedades] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize] = useState(5);
  const [detailId, setDetailId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [formData, setFormData] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [savedOk, setSavedOk] = useState(false);
  const [showConvertir, setShowConvertir] = useState(false);

  const rules = useMemo(() => {
    const r = {
      Id_TipoDoc: (v) => V.requiredSelect(v, 'El tipo de documento'),
      Documento:  V.documento,
      Nombre:     (v) => V.nombre(v, 3, 100),
      Correo:     (v) => V.correo(v, false) || V.maxLen(v, 120, 'El correo'),
      Id_Rol:     (v) => V.requiredSelect(v, 'El rol'),
    };
    if (!editingId) {
      // Al crear: contraseña obligatoria + confirmación.
      r.Password = V.passwordFuerte;
      r.ConfirmPassword = (v, all) => V.confirmarPassword(v, all.Password);
    } else {
      // Al editar: opcional; solo se valida si el admin escribe una nueva.
      r.Password = (v) => (String(v ?? '') === '' ? '' : V.passwordFuerte(v));
      r.ConfirmPassword = (v, all) => (String(all.Password ?? '') === '' ? '' : V.confirmarPassword(v, all.Password));
    }
    return r;
  }, [editingId]);
  const { errors, touched, setErrors, revalidate, markTouched, touchAll, fieldError, isInvalid, validateNow, reset } = useFormValidation(rules);

  useEffect(() => {
    dispatch(fetchEmpleados());
    api.get('/api/catalogos/tipos-documento').then(r => setTiposDoc(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/roles').then(r => setRoles(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/novedades').then(r => setNovedades(r.data?.data || r.data || [])).catch(() => {});
  }, [dispatch]);


  const getEmpNovedades = (id) => novedades.filter(n => n.id_empleado === id || n.Id_Empleado === id);

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    list = filterItems(list, search, ['Nombre', 'Documento', 'Correo']);
    return sortByStatus(sortNewestFirst(list, 'Id_Empleado'));
  })();

  const openCreate = () => {
    setFormData(EMPTY); setEditingId(null); setFormError(''); reset();
    setShowPassword(false); setShowConfirm(false); setFotoPreview(null); setPhotoFile(null); setSavedOk(false); setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.Id_Empleado); setFormError(''); setSavedOk(false); setShowPassword(false); setShowConfirm(false); reset();
    setFotoPreview(item.Foto_url || item.Foto || null);
    setPhotoFile(null);
    setFormData({
      Nombre: item.Nombre || '', Id_TipoDoc: String(item.Id_TipoDoc || ''),
      Documento: item.Documento || '', Id_Rol: String(item.Id_Rol || ''),
      Correo: item.Correo || '', Password: '', ConfirmPassword: '',
    });
    setShowForm(true);
  };

  const setField = (name, value) => {
    const next = { ...formData, [name]: value };
    setFormData(next);
    if (touched[name] || errors[name]) revalidate(next);
  };
  const handleChange = (e) => setField(e.target.name, e.target.value);
  const handleBlur = (e) => { markTouched(e.target.name); revalidate(formData); };

  const handlePhotoChange = (file) => {
    setPhotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateNow(formData);
    setErrors(errs); touchAll();
    if (V.hasErrors(errs)) { setFormError('Corrige los campos marcados antes de guardar.'); return; }
    setFormError('');

    const fd = new FormData();
    fd.append('Nombre', formData.Nombre);
    fd.append('Documento', formData.Documento);
    fd.append('Id_TipoDoc', formData.Id_TipoDoc);
    fd.append('Id_Rol', formData.Id_Rol);
    fd.append('Correo', formData.Correo);
    if (formData.Password) fd.append('Password', formData.Password);
    if (photoFile) fd.append('foto', photoFile);

    const action = editingId ? updateEmpleado({ id: editingId, data: fd }) : createEmpleado(fd);
    const result = await dispatch(action);
    if (!result.error) {
      setShowForm(false); setSavedOk(true); dispatch(fetchEmpleados());
      setTimeout(() => setSavedOk(false), 3000);
    } else { setFormError(result.payload || 'Error al guardar.'); }
  };

  const tiposDocOpts = tiposDoc.map(t => ({ value: String(t.Id_TipoDoc), label: t.Nombre }));
  const rolesOpts    = roles.map(r => ({ value: String(r.Id_Rol), label: r.Nombre }));

  // "Sistema": solo el super admin protegido (Empleado.EsSistema o rol Super Administrador).
  // Sus filas no muestran acciones (eliminar/cambiar estado). Los demás admin sí se gestionan.
  const esAdminSistema = (emp) => emp?.EsSistema === true || emp?.Rol === 'Super Administrador';

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    {
      key: 'Nombre', label: 'Nombre', render: (v, row) => (
        <div className="emp-cell">
          {(row.Foto_url || row.Foto)
            ? <img src={row.Foto_url || row.Foto} alt="" className="emp-avatar" />
            : <div className="emp-avatar emp-avatar--fallback">{v?.charAt(0)}</div>
          }
          <span className="font-medium">{v}</span>
        </div>
      )
    },
    { key: 'Documento', label: 'Documento' },
    { key: 'Rol', label: 'Rol' },
    { key: 'Correo', label: 'Correo' },
    {
      key: 'novedades', label: 'Novedades', render: (_, row) => {
        const novs = getEmpNovedades(row.Id_Empleado);
        return novs.length > 0
          ? <Badge variant="warning"><MdWarning size={12} className="u-ic-mr" />{novs.length} novedad(es)</Badge>
          : <span className="text-muted fs-sm">Sin novedades</span>;
      }
    },
    {
      key: 'Estado', label: 'Estado',
      // Solo se muestra para las cuentas de sistema (no tienen toggle porque no se
      // pueden desactivar); en las demás filas el ToggleSwitch de Acciones ya
      // indica si está activo o inactivo, mostrarlo dos veces era redundante.
      render: (v, row) => esAdminSistema(row) ? <Badge variant="gray">Sistema</Badge> : null,
    },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          {!esAdminSistema(row) && (
            <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleEmpleadoEstado({ id: row.Id_Empleado, Estado: row.Estado === 1 ? 0 : 1 }))} disabled={!puedeToggle} />
          )}
          <button className="btn btn--ghost btn--icon btn--sm" title="Ver" onClick={() => setDetailId(row.Id_Empleado)}><MdVisibility size={17} /></button>
          {!esAdminSistema(row) && (
            <>
              <button className="btn btn--ghost btn--icon btn--sm" title="Editar" disabled={!puedeEditar} onClick={() => openEdit(row)}><MdEdit size={17} /></button>
              {esSuperadmin ? (
                /* Superadmin: borrado real con bloqueo duro (muestra dependencias;
                   no exige desactivar primero). Reemplaza al borrado operativo. */
                <button className="btn btn--danger btn--icon btn--sm" title="Eliminar definitivamente (superadmin)"
                  onClick={() => del.open(row.Id_Empleado)}>
                  <MdDeleteForever size={17} />
                </button>
              ) : row.Estado === 0 && (
                <button className="btn btn--danger btn--icon btn--sm" title="Eliminar por completo" disabled={!puedeToggle}
                  onClick={() => { setDeleteError(''); setDeleteId(row.Id_Empleado); }}>
                  <MdDeleteForever size={17} />
                </button>
              )}
            </>
          )}
        </div>
      )
    },
  ];

  // Derivado de `items` en cada render (no un snapshot congelado en useState): así el
  // modal de detalle refleja en tiempo real cualquier cambio de Estado/datos hecho desde
  // la tabla o desde otra pestaña, en vez de quedarse con la foto del momento del click.
  const detailItem = detailId ? items.find(i => i.Id_Empleado === detailId) || null : null;
  const detailNovedades = detailItem ? getEmpNovedades(detailItem.Id_Empleado) : [];

  const handleDelete = async () => {
    setDeleteError('');
    const result = await dispatch(deleteEmpleado(deleteId));
    if (!result.error) setDeleteId(null);
    else setDeleteError(result.payload || 'No se pudo eliminar el empleado.');
  };

  // Vía "Reasignar y eliminar": solo cuando el bloqueo es por órdenes/novedades
  // (no cuando es un empleado protegido). Se inyecta en el modal de bloqueo.
  const _bloq = del.preview?.bloqueantes || [];
  const _ordCount = _bloq.find(b => b.tabla === 'Orden_de_Trabajo')?.cantidad ?? 0;
  const _novCount = _bloq.find(b => b.tabla === 'Novedades')?.cantidad ?? 0;
  const puedeReasignar = !!del.preview?.bloqueado && (_ordCount > 0 || _novCount > 0);
  const destinoOpts = items
    .filter(e => e.Estado === 1 && String(e.Id_Empleado) !== String(del.preview?.id) && !esAdminSistema(e))
    .map(e => ({ value: String(e.Id_Empleado), label: `${e.Nombre} — ${e.Documento}` }));
  const destinoNombre = items.find(e => String(e.Id_Empleado) === String(reasignarDestino))?.Nombre;
  const textoOk = reasignarTexto.trim() === del.preview?.textoConfirmacion;

  const reasignarNode = puedeReasignar ? (
    <div className="reasignar-box">
      <div className="reasignar-box__head"><MdSwapHoriz size={17} /> Reasignar y eliminar</div>
      <p className="reasignar-box__intro">Mové su trabajo a otro empleado y eliminá este. Las novedades se descartan.</p>
      <label className="form-label">Reasignar a</label>
      <SearchableSelect
        options={destinoOpts}
        value={reasignarDestino}
        onChange={setReasignarDestino}
        placeholder="Empleado activo destino..."
      />
      {reasignarDestino && (
        <p className="reasignar-box__resumen">
          Se reasignarán <strong>{_ordCount}</strong> orden(es) a <strong>{destinoNombre}</strong> y se eliminarán <strong>{_novCount}</strong> novedad(es).
        </p>
      )}
      <label className="form-label" style={{ marginTop: '0.5rem' }}>Para confirmar, escribe: <code>{del.preview?.textoConfirmacion}</code></label>
      <input className="form-control" value={reasignarTexto} autoComplete="off" spellCheck={false}
        onChange={e => setReasignarTexto(e.target.value)} placeholder={del.preview?.textoConfirmacion} />
      {reasignarError && <div className="form-error-box" style={{ marginTop: '0.5rem' }}>{reasignarError}</div>}
      <button className="btn btn--danger" style={{ marginTop: '0.625rem' }}
        disabled={reasignarLoading || !reasignarDestino || !textoOk}
        onClick={handleReasignar}>
        <MdSwapHoriz size={16} /> {reasignarLoading ? 'Reasignando…' : 'Reasignar y eliminar'}
      </button>
    </div>
  ) : null;

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Empleados</h1>
          <p className="page__subtitle">{items.length} empleado(s) registrado(s)</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nuevo empleado</button>
      </div>

      {savedOk && (
        <div className="emp-novedad-banner">
          <MdCheck size={16} className="u-ic-mr" /> Empleado guardado correctamente.
        </div>
      )}

      <div className="card">
        <div className="card__header">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, documento, correo..."
            filterSlot={<FilterDropdown statusFilter={statusFilter} onStatusChange={setStatusFilter} pageSize={pageSize} onPageSizeChange={setPageSize} />}
          />
        </div>
        <Table columns={columns} rowKey="Id_Empleado" data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron empleados" />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailId(null)} title="Detalle del empleado" size="lg">
        {detailItem && (
          <div>
            <div className="detail-grid u-mb-xl">
              <div className="detail-item"><span className="detail-label">Nombre</span><span className="detail-value">{detailItem.Nombre}</span></div>
              <div className="detail-item"><span className="detail-label">Documento</span><span className="detail-value">{detailItem.Documento}</span></div>
              <div className="detail-item"><span className="detail-label">Tipo documento</span><span className="detail-value">{detailItem.TipoDocumento || detailItem.Id_TipoDoc}</span></div>
              <div className="detail-item"><span className="detail-label">Rol</span><span className="detail-value">{detailItem.Rol || detailItem.Id_Rol}</span></div>
              <div className="detail-item"><span className="detail-label">Correo</span><span className="detail-value">{detailItem.Correo}</span></div>
              <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><StatusBadge estado={detailItem.Estado} /></span></div>
            </div>
            {detailNovedades.length > 0 && (
              <div>
                <h4 className="u-mb-md fs-body u-bold">Novedades registradas</h4>
                <div className="novedades-list">
                  {detailNovedades.map((n, i) => (
                    <div key={i} className="novedad-item">
                      <MdWarning size={16} className="text-warning" style={{ flexShrink: 0 }} />
                      <div>
                        <p className="fs-body u-semibold">{n.Descripcion}</p>
                        <p className="u-hint">{formatDate(n.Fecha_Novedad)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar empleado' : 'Nuevo empleado'} size="lg"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading || isInvalid(formData)}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <form className="form-grid" onSubmit={handleSubmit} noValidate>

          {/* Avatar (opcional) */}
          <div className="form-group span-2">
            <div className="form-avatar-row">
              <ImageUploader
                preview={fotoPreview}
                onChange={handlePhotoChange}
                size={60}
                initials={formData.Nombre?.charAt(0)?.toUpperCase()}
              />
              <span className="form-hint">Foto del empleado (opcional)</span>
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
            <input name="Documento" className={`form-control ${fieldError('Documento') ? 'is-error' : ''}`} value={formData.Documento} onChange={handleChange} onBlur={handleBlur} inputMode="numeric" maxLength={10} placeholder="Número de documento" />
            {fieldError('Documento') && <p className="form-error">{fieldError('Documento')}</p>}
          </div>

          {/* 3. Nombres */}
          <div className="form-group span-2">
            <label className="form-label">Nombres <span className="required">*</span></label>
            <input name="Nombre" className={`form-control ${fieldError('Nombre') ? 'is-error' : ''}`} value={formData.Nombre} onChange={handleChange} onBlur={handleBlur} maxLength={100} placeholder="Nombre completo" />
            {fieldError('Nombre') && <p className="form-error">{fieldError('Nombre')}</p>}
          </div>

          {/* 4. (Teléfono no existe en el modelo Empleado → pendiente de esquema) */}

          {/* 5. Correo electrónico */}
          <div className="form-group span-2">
            <label className="form-label">Correo electrónico <span className="required">*</span></label>
            <input name="Correo" type="email" className={`form-control ${fieldError('Correo') ? 'is-error' : ''}`} value={formData.Correo} onChange={handleChange} onBlur={handleBlur} maxLength={120} placeholder="correo@empresa.com" />
            {fieldError('Correo') && <p className="form-error">{fieldError('Correo')}</p>}
          </div>

          {/* 6. Contraseña + Confirmar */}
          <div className="form-group">
            <label className="form-label">
              Contraseña {!editingId && <span className="required">*</span>}
              {editingId && <span className="form-label__hint">(dejar vacío para no cambiar)</span>}
            </label>
            <div className="form-password-wrap">
              <input name="Password" type={showPassword ? 'text' : 'password'} className={`form-control ${fieldError('Password') ? 'is-error' : ''}`} value={formData.Password} onChange={handleChange} onBlur={handleBlur} placeholder={editingId ? 'Nueva contraseña' : 'Mínimo 8, letra y número'} />
              <button type="button" className="form-password-toggle" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
              </button>
            </div>
            {fieldError('Password') && <p className="form-error">{fieldError('Password')}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">
              Confirmar contraseña {!editingId && <span className="required">*</span>}
            </label>
            <div className="form-password-wrap">
              <input name="ConfirmPassword" type={showConfirm ? 'text' : 'password'} className={`form-control ${fieldError('ConfirmPassword') ? 'is-error' : ''}`} value={formData.ConfirmPassword} onChange={handleChange} onBlur={handleBlur} placeholder="Repite la contraseña" />
              <button type="button" className="form-password-toggle" onClick={() => setShowConfirm(p => !p)} tabIndex={-1}>
                {showConfirm ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
              </button>
            </div>
            {fieldError('ConfirmPassword') && <p className="form-error">{fieldError('ConfirmPassword')}</p>}
          </div>

          {/* 7. Rol (al final) */}
          <div className="form-group span-2">
            <label className="form-label">Rol <span className="required">*</span></label>
            <SearchableSelect
              options={rolesOpts}
              value={String(formData.Id_Rol)}
              onChange={v => { setField('Id_Rol', v); markTouched('Id_Rol'); }}
              placeholder="Seleccionar rol..."
              disabled={!!(editingId && esAdminSistema(items.find(e => e.Id_Empleado === editingId)))}
            />
            {fieldError('Id_Rol') && <p className="form-error">{fieldError('Id_Rol')}</p>}
          </div>

          {editingId && esSuperadmin && !esAdminSistema(items.find(e => e.Id_Empleado === editingId)) && (
            <div className="form-group span-2 convertir-box">
              <div className="convertir-box__head"><MdSwapHoriz size={17} /> Convertir en cliente</div>
              <p className="convertir-box__intro">
                Da de baja a este empleado y crea una cuenta de cliente con sus mismos datos.
                Se bloquea si tiene órdenes de trabajo o novedades asignadas. Requiere
                confirmación por texto y no se puede deshacer.
              </p>
              <button type="button" className="btn btn--outline" onClick={() => setShowConvertir(true)}>
                <MdSwapHoriz size={16} /> Convertir a cliente…
              </button>
            </div>
          )}

        </form>
      </Modal>

      <ConvertirAClienteModal
        isOpen={showConvertir}
        onClose={() => setShowConvertir(false)}
        empleado={editingId ? items.find(e => e.Id_Empleado === editingId) : null}
        onSuccess={() => {
          setShowConvertir(false);
          setShowForm(false);
          addToast({ type: 'success', message: 'Empleado convertido en cliente correctamente.' });
          dispatch(fetchEmpleados());
        }}
      />

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => { setDeleteId(null); setDeleteError(''); }}
        onConfirm={handleDelete}
        title="Eliminar empleado por completo"
        message={deleteError || 'Esta acción borra al empleado de forma definitiva y no se puede deshacer. Su historial de citas ya cerradas y novedades se conserva sin asignar. Si tiene citas pendientes o confirmadas, primero debes reasignarlas o cancelarlas.'}
        confirmLabel="Eliminar definitivamente"
        danger
        loading={actionLoading}
      />

      <EliminarRealModal isOpen={del.isOpen} onClose={del.close} entidadLabel="empleado"
        preview={del.preview} loadingPreview={del.loadingPreview} deleting={del.deleting} error={del.error} onConfirm={del.confirm}
        accionBloqueado={reasignarNode} />
    </div>
  );
}
