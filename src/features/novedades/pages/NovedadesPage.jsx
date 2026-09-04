import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit, MdDeleteForever } from 'react-icons/md';
import { useBorradoReal } from '../../../shared/hooks/useBorradoReal.js';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh.js';
import { novedadesService } from '../services/novedadesService.js';
import EliminarRealModal from '../../../shared/components/EliminarRealModal/EliminarRealModal.jsx';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchNovedades, createNovedad, updateNovedad, toggleNovedadEstado } from '../slices/novedadesSlice.js';
import { useToast } from '../../../shared/components/Toast/ToastContext.jsx';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { filterItems, sortNewestFirst, formatDate, todayLocalYMD } from '../../../shared/utils/helpers.js';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import api from '../../../shared/services/api.js';
import './NovedadesPage.css';

const EMPTY = { id_empleado: '', Descripcion: '', Fecha_Novedad: '', FechaRealizacion: '', HoraInicio: '', HoraFin: '' };
const TODAY = todayLocalYMD();
const RULES = {
  id_empleado: (v) => V.requiredSelect(v, 'El empleado'),
  Descripcion: (v) => V.required(v, 'La descripción') || V.maxLen(v, 500, 'La descripción'),
  // Por defecto es hoy, pero editable hacia el futuro (incapacidad/permiso).
  Fecha_Novedad: (v) => V.requiredSelect(v, 'La fecha de la novedad'),
};

export default function NovedadesPage() {
  const dispatch = useDispatch();
  const { addToast } = useToast();
  const { items, loading, actionLoading } = useSelector(s => s.novedades);
  const puedeCrear   = usePermiso('NOVEDADES.REGISTRAR');
  const puedeEditar  = usePermiso('NOVEDADES.EDITAR');
  const puedeToggle  = usePermiso('NOVEDADES.CAMBIAR_ESTADO');
  const esSuperadmin = useSelector(s => s.auth.empleado?.EsSuperAdmin === true);
  const del = useBorradoReal(novedadesService, { entidadLabel: 'novedad', onDeleted: () => dispatch(fetchNovedades()) });
  const [empleados, setEmpleados] = useState([]);
  const [search, setSearch]       = useState('');
  const [pageSize, setPageSize]   = useState(5);
  const [detailItem, setDetailItem] = useState(null);
  const [formData, setFormData]   = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [formError, setFormError] = useState('');
  const { errors, touched, setErrors, revalidate, markTouched, touchAll, fieldError, isInvalid, validateNow, reset } = useFormValidation(RULES);

  useEffect(() => {
    dispatch(fetchNovedades());
    api.get('/api/empleados').then(r => setEmpleados(r.data?.data || r.data || [])).catch(() => {});
  }, [dispatch]);

  useAutoRefresh(() => dispatch(fetchNovedades()), { intervalMs: 20000, enabled: !showForm && !del.isOpen });

  const getEmpleadoNombre = (id) => {
    const e = empleados.find(e => String(e.id_empleado ?? e.Id_Empleado) === String(id));
    return e?.Nombre || `Empleado #${id}`;
  };

  const filtered = sortNewestFirst(filterItems(items, search, ['Descripcion']), 'Id_Novedad');

  // La fecha de la novedad se ingresa manualmente (puede ser futura: incapacidad/permiso).
  const openCreate = () => { setFormData(EMPTY); setEditingId(null); setFormError(''); reset(); setShowForm(true); };
  const openEdit   = (item) => {
    setFormData({
      id_empleado:     item.id_empleado || item.Id_Empleado || '',
      Descripcion:     item.Descripcion || '',
      Fecha_Novedad:   item.Fecha_Novedad   ? item.Fecha_Novedad.split('T')[0]   : '',
      FechaRealizacion: item.FechaRealizacion ? item.FechaRealizacion.split('T')[0] : '',
      HoraInicio: item.HoraInicio || '',
      HoraFin:    item.HoraFin    || '',
    });
    setEditingId(item.Id_Novedad || item.id); setFormError(''); reset(); setShowForm(true);
  };
  const handleChange = e => {
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

    if (formData.FechaRealizacion && formData.FechaRealizacion < formData.Fecha_Novedad) {
      setFormError('La fecha de fin no puede ser anterior a la fecha de la novedad.'); return;
    }

    // Rango horario opcional: ambas horas o ninguna, y fin > inicio (misma regla del backend).
    if ((formData.HoraInicio && !formData.HoraFin) || (!formData.HoraInicio && formData.HoraFin)) {
      setFormError('Indica la hora de inicio y la hora de fin, o deja ambas vacías.'); return;
    }
    if (formData.HoraInicio && formData.HoraFin && formData.HoraFin <= formData.HoraInicio) {
      setFormError('La hora de fin debe ser posterior a la hora de inicio.'); return;
    }

    // Regla: un empleado no puede tener 3 o más novedades en la MISMA fecha.
    // Se cuentan las novedades ya registradas para ese empleado en ese día
    // (excluyendo la que se está editando). Si ya hay 2, se bloquea la 3.ª.
    const empSel   = String(formData.id_empleado);
    const fechaSel = formData.Fecha_Novedad;
    const mismasDelDia = items.filter(n => {
      const nId = n.Id_Novedad ?? n.id;
      if (editingId && String(nId) === String(editingId)) return false;
      const nEmp   = String(n.id_empleado ?? n.Id_Empleado);
      const nFecha = (n.Fecha_Novedad || '').split('T')[0];
      return nEmp === empSel && nFecha === fechaSel;
    });
    if (mismasDelDia.length >= 2) {
      setFormError('Este empleado ya tiene 2 novedades registradas en esa fecha. No se permiten 3 o más el mismo día.');
      return;
    }

    setFormError('');
    const payload = {
      id_empleado:   Number(formData.id_empleado),
      Descripcion:   formData.Descripcion,
      Fecha_Novedad: new Date(formData.Fecha_Novedad).toISOString(),
      ...(formData.FechaRealizacion
        ? { FechaRealizacion: new Date(formData.FechaRealizacion).toISOString() }
        : {}),
      // null limpia el rango horario al editar (backend: HoraInicio/HoraFin ambas o ninguna).
      HoraInicio: formData.HoraInicio || null,
      HoraFin:    formData.HoraFin    || null,
    };
    const action = editingId ? updateNovedad({ id: editingId, data: payload }) : createNovedad(payload);
    const result = await dispatch(action);
    if (!result.error) {
      setShowForm(false);
      dispatch(fetchNovedades());
      avisarConflictos(result.payload?.notificacion);
    }
    else setFormError(result.payload || 'Error al guardar.');
  };

  // Cuando la novedad choca con citas ya agendadas del empleado, el backend notificó por
  // correo a cada cliente (reasignar con otro técnico o cancelar, desde el portal). Se
  // avisa al admin cuántos correos salieron para que sepa que no fue una acción silenciosa.
  const avisarConflictos = (notificacion) => {
    const n = notificacion?.citasNotificadas?.length || 0;
    if (n > 0) {
      addToast({ type: 'info', message: `Se notificó por correo a ${n} cliente${n === 1 ? '' : 's'} con cita en conflicto, para que reasignen con otro técnico o cancelen.` });
    }
  };

  const handleToggleEstado = async (row) => {
    const result = await dispatch(toggleNovedadEstado({ id: row.Id_Novedad || row.id, Estado: row.Estado === 1 ? 0 : 1 }));
    if (!result.error) avisarConflictos(result.payload?.notificacion);
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'id_empleado', label: 'Empleado', render: (v, row) => getEmpleadoNombre(v || row.Id_Empleado) },
    { key: 'Descripcion', label: 'Descripción', render: v => <span className="descripcion-cell">{v}</span> },
    { key: 'Fecha_Novedad',    label: 'Fecha novedad',    render: v => formatDate(v) },
    { key: 'FechaRealizacion', label: 'Fecha realización', render: v => formatDate(v) },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <ToggleSwitch
            checked={row.Estado === 1}
            onChange={() => handleToggleEstado(row)}
            disabled={!puedeToggle}
          />
          <button className="btn btn--ghost btn--icon btn--sm" title="Ver" onClick={() => setDetailItem(row)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" title="Editar" disabled={!puedeEditar} onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          {esSuperadmin && (
            <button className="btn btn--ghost btn--icon btn--sm btn--danger-ghost" title="Eliminar definitivamente" onClick={() => del.open(row.Id_Novedad)}><MdDeleteForever size={17} /></button>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Novedades</h1><p className="page__subtitle">{items.length} novedad(es) registrada(s)</p></div>
        <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nueva novedad</button>
      </div>
      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por descripción..."
            filterSlot={
              <FilterDropdown
                statusFilter="todos"
                onStatusChange={() => {}}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
              />
            }
          />
        </div>
        <Table columns={columns} rowKey="Id_Novedad" data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron novedades" />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Detalle de la novedad" size="md">
        {detailItem && <div className="detail-grid">
          <div className="detail-item"><span className="detail-label">Empleado</span><span className="detail-value">{getEmpleadoNombre(detailItem.id_empleado || detailItem.Id_Empleado)}</span></div>
          <div className="detail-item"><span className="detail-label">Fecha novedad</span><span className="detail-value">{formatDate(detailItem.Fecha_Novedad)}</span></div>
          <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Descripción</span><span className="detail-value">{detailItem.Descripcion}</span></div>
          <div className="detail-item"><span className="detail-label">Fecha realización</span><span className="detail-value">{formatDate(detailItem.FechaRealizacion)}</span></div>
          <div className="detail-item"><span className="detail-label">Rango horario</span><span className="detail-value">{detailItem.HoraInicio && detailItem.HoraFin ? `${detailItem.HoraInicio} – ${detailItem.HoraFin}` : 'Día completo'}</span></div>
        </div>}
      </Modal>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar novedad' : 'Nueva novedad'} size="md"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading || isInvalid(formData)}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="form-group span-2">
            <label className="form-label">Empleado <span className="required">*</span></label>
            <SearchableSelect
              options={empleados.map(e => ({ value: String(e.id_empleado ?? e.Id_Empleado), label: `${e.Nombre} — ${e.Documento}` }))}
              value={String(formData.id_empleado)}
              onChange={v => { setFormData(p => ({ ...p, id_empleado: v })); markTouched('id_empleado'); }}
              placeholder="Seleccionar empleado..."
            />
            {fieldError('id_empleado') && <p className="form-error">{fieldError('id_empleado')}</p>}
          </div>
          <div className="form-group span-2">
            <label className="form-label">Descripción <span className="required">*</span></label>
            <textarea name="Descripcion" className={`form-control ${fieldError('Descripcion') ? 'is-error' : ''}`} value={formData.Descripcion} onChange={handleChange} onBlur={handleBlur} rows={3} maxLength={500} placeholder="Describe la novedad..." />
            {fieldError('Descripcion') && <p className="form-error">{fieldError('Descripcion')}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Fecha de la novedad <span className="required">*</span></label>
            <input name="Fecha_Novedad" type="date" className={`form-control ${fieldError('Fecha_Novedad') ? 'is-error' : ''}`} value={formData.Fecha_Novedad} onChange={handleChange} onBlur={handleBlur} min={TODAY} />
            {fieldError('Fecha_Novedad') && <p className="form-error">{fieldError('Fecha_Novedad')}</p>}
            <p className="form-hint">Puede ser hoy o una fecha futura (incapacidad o permiso).</p>
          </div>
          <div className="form-group">
            <label className="form-label">Fecha de fin (realización)</label>
            <input name="FechaRealizacion" type="date" className="form-control" value={formData.FechaRealizacion} onChange={handleChange} min={formData.Fecha_Novedad || TODAY} />
            <p className="form-hint">Fin de la incapacidad o permiso (opcional).</p>
          </div>
          <div className="form-group">
            <label className="form-label">Hora de inicio</label>
            <input name="HoraInicio" type="time" className="form-control" value={formData.HoraInicio} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Hora de fin</label>
            <input name="HoraFin" type="time" className="form-control" value={formData.HoraFin} onChange={handleChange} />
            <p className="form-hint">Opcional: si indicas un rango de horas, la novedad solo bloquea esas horas ese día (si lo dejas vacío, bloquea el día completo).</p>
          </div>
        </form>
      </Modal>

      <EliminarRealModal isOpen={del.isOpen} onClose={del.close} entidadLabel="novedad"
        preview={del.preview} loadingPreview={del.loadingPreview} deleting={del.deleting} error={del.error} onConfirm={del.confirm} />
    </div>
  );
}

