import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit, MdDeleteForever } from 'react-icons/md';
import { useBorradoReal } from '../../../shared/hooks/useBorradoReal.js';
import { serviciosService } from '../services/serviciosService.js';
import EliminarRealModal from '../../../shared/components/EliminarRealModal/EliminarRealModal.jsx';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { createServicio, updateServicio, toggleServicioEstado } from '../slices/serviciosSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { formatCurrency } from '../../../shared/utils/helpers.js';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import api from '../../../shared/services/api.js';

/* MISMA convencion que Repuestos: el FORMULARIO habla en porcentaje entero
   (50) y la API en factor decimal (0.5). La conversion vive en dos sitios y
   solo dos -- openEdit al cargar y handleSubmit al enviar.

   El redondeo del factor -> porcentaje no es cosmetico: muchos factores no son
   exactos en binario y salen con cola (0.07*100 = 7.000000000000001), que en un
   input type=number se ve. */
const _factorAPorcentaje = (factor) => Math.round(Number(factor) * 1000) / 10;
const _porcentajeAFactor = (pct) => Number(pct) / 100;
const _margenPorcentaje = (factor) => {
  const f = Number(factor);
  if (!Number.isFinite(f)) return '—';
  const pct = _factorAPorcentaje(f);
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
};

/* Previsualizacion del precio de venta: la MISMA formula que el servidor
   (servicio.model.js -> utils/precioVenta.js). Se duplica el calculo a
   proposito y solo para mirar -- lo que se guarda lo calcula la API, aqui no se
   envia ningun precio derivado. */
const _previewVenta = (costo, pct) => {
  const c = Number(costo);
  const m = _porcentajeAFactor(pct);
  if (!Number.isFinite(c) || c <= 0 || !Number.isFinite(m) || m <= 0 || m > 1) return null;
  return Math.round(c / m + c * 0.19);
};

const EMPTY = { Nombre: '', Descripcion: '', Precio: '', PrecioCosto: '', MargenGanancia: '50', DuracionMinutos: '' };
const RULES = {
  Nombre: (v) => V.nombre(v, 3, 80),
  Descripcion: (v) => V.maxLen(v, 200, 'La descripción'),
  /* Precio pasa a ser OPCIONAL: con costo + margen lo calcula el servidor, y
     exigirlo ademas obligaria a teclear dos veces el mismo numero. La regla de
     "uno de los dos" se comprueba en handleSubmit, que es donde se conocen los
     dos campos a la vez. */
  Precio: (v) => (v == null || String(v).trim() === '' ? '' : V.numeroPositivo(v, 'El precio')),
  PrecioCosto: (v) => (v == null || String(v).trim() === '' ? '' : V.numeroPositivo(v, 'El costo')),
  // En PORCENTAJE. El tope de 100 es el limite de la API (factor <= 1) en esta unidad.
  MargenGanancia: (v) => {
    if (v == null || String(v).trim() === '') return '';
    const n = Number(v);
    if (Number.isNaN(n)) return 'El margen debe ser un número.';
    if (n <= 0) return 'El margen debe ser mayor que 0 %.';
    if (n > 100) return 'El margen no puede pasar del 100 %: sería vender por debajo del costo.';
    return '';
  },
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
  const { actionLoading } = useSelector(s => s.servicios);
  const puedeCrear   = usePermiso('SERVICIOS.REGISTRAR');
  const puedeEditar  = usePermiso('SERVICIOS.EDITAR');
  const puedeToggle  = usePermiso('SERVICIOS.CAMBIAR_ESTADO');
  const esSuperadmin = useSelector(s => s.auth.empleado?.EsSuperAdmin === true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize] = useState(5);
  // Estado del listado SERVER-SIDE (mismo patrón que RepuestosPage).
  const [page, setPage]         = useState(1);
  const [rows, setRows]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [detailItem, setDetailItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const { errors, touched, setErrors, revalidate, markTouched, touchAll, fieldError, isInvalid, validateNow, reset } = useFormValidation(RULES);

  const fetchPage = useCallback(async () => {
    setListLoading(true);
    try {
      const ps = pageSize === 'all' ? 9999 : pageSize;
      const params = new URLSearchParams({ page: String(page), pageSize: String(ps), estado: statusFilter });
      if (search) params.set('search', search);
      const r = await api.get(`/api/servicios?${params.toString()}`);
      // Estado viene como booleano crudo de Postgres -- ToggleSwitch compara === 1.
      setRows((r.data?.data || []).map(x => ({ ...x, Estado: x.Estado === true ? 1 : x.Estado === false ? 0 : x.Estado })));
      setTotal(r.data?.total ?? 0);
    } catch { setRows([]); setTotal(0); }
    finally { setListLoading(false); }
  }, [page, pageSize, search, statusFilter]);

  const del = useBorradoReal(serviciosService, { entidadLabel: 'servicio', onDeleted: fetchPage });

  useEffect(() => { fetchPage(); }, [fetchPage]);

  const onSearch   = (v) => { setSearch(v); setPage(1); };
  const onStatus   = (v) => { setStatusFilter(v); setPage(1); };
  const onPageSize = (v) => { setPageSize(v); setPage(1); };

  const openCreate = () => { setFormData(EMPTY); setEditingId(null); setFormError(''); reset(); setShowForm(true); };
  const openEdit = (item) => {
    setFormData({
      Nombre: item.Nombre || '',
      Descripcion: item.Descripcion || '',
      Precio: item.Precio || '',
      PrecioCosto: item.PrecioCosto ?? '',
      // factor -> %
      MargenGanancia: String(_factorAPorcentaje(item.MargenGanancia ?? 0.5)),
      DuracionMinutos: item.DuracionMinutos ?? '',
    });
    setEditingId(item.Id_Servicio); setFormError(''); reset(); setShowForm(true);
  };
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
    const dur   = String(formData.DuracionMinutos ?? '').trim();
    const costo = String(formData.PrecioCosto ?? '').trim();
    const prec  = String(formData.Precio ?? '').trim();

    /* Uno de los dos hace falta: o el costo (y el servidor deriva el precio) o
       el precio a mano. Se comprueba aqui y no en RULES porque la regla mira
       DOS campos, y una regla por campo no puede decidirlo sin marcar el
       equivocado. */
    if (costo === '' && prec === '') {
      setFormError('Indica el costo del servicio (el precio de venta se calcula solo) o escribe el precio a mano.');
      return;
    }

    const payload = {
      Nombre: formData.Nombre,
      Descripcion: formData.Descripcion,
      DuracionMinutos: dur === '' ? null : Number(dur),
    };
    if (costo !== '') {
      payload.PrecioCosto = Number(costo);
      // % -> factor. La API espera el factor; si este /100 se cayera, Joi lo
      // rechaza con "no puede ser mayor que 1".
      payload.MargenGanancia = _porcentajeAFactor(formData.MargenGanancia ?? 50);
    }
    /* El Precio solo viaja si se escribio a mano Y no hay costo: con costo, el
       servidor lo calcula y manda el suyo -- enviar ambos deja al servidor
       eligiendo entre dos precios de venta para el mismo servicio. */
    if (prec !== '' && costo === '') payload.Precio = Number(prec);
    const action = editingId ? updateServicio({ id: editingId, data: payload }) : createServicio(payload);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); fetchPage(); }
    else setFormError(result.payload || 'No se pudo guardar el servicio.');
  };

  const handleToggle = async (row) => {
    await dispatch(toggleServicioEstado({ id: row.Id_Servicio, Estado: row.Estado === 1 ? 0 : 1 }));
    fetchPage();
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Nombre', label: 'Nombre', render: v => <span className="font-semibold">{v}</span> },
    { key: 'Descripcion', label: 'Descripción', render: v => <span className="line-clamp-2 max-w-[250px] text-body text-text-muted">{v || '—'}</span> },
    { key: 'PrecioCosto', label: 'Costo', render: v => (v != null && Number(v) > 0 ? formatCurrency(v) : '—') },
    { key: 'MargenGanancia', label: 'Margen', render: v => _margenPorcentaje(v ?? 0.5) },
    { key: 'Precio', label: 'Precio venta', render: v => formatCurrency(v) },
    { key: 'DuracionMinutos', label: 'Duración', render: v => (v ? `${v} min` : '—') },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <ToggleSwitch checked={row.Estado === 1} onChange={() => handleToggle(row)} disabled={!puedeToggle} />
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
        <div><h1 className="page__title">Servicios</h1><p className="page__subtitle">{total} servicio(s) disponible(s)</p></div>
        <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nuevo servicio</button>
      </div>
      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={onSearch}
            placeholder="Buscar por nombre, descripción..."
            filterSlot={
              <FilterDropdown
                statusFilter={statusFilter}
                onStatusChange={onStatus}
                pageSize={pageSize}
                onPageSizeChange={onPageSize}
              />
            }
          />
        </div>
        <Table
          columns={columns}
          rowKey="Id_Servicio"
          data={rows}
          loading={listLoading}
          serverSide
          total={total}
          page={page}
          onPageChange={setPage}
          pageSize={pageSize}
          searchTerm={search}
          onClearSearch={() => onSearch('')}
          emptyMessage="No se encontraron servicios"
        />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Detalle del servicio" size="md">
        {detailItem && <div className="detail-grid">
          <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Nombre</span><span className="detail-value">{detailItem.Nombre}</span></div>
          <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Descripción</span><span className="detail-value">{detailItem.Descripcion || '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Costo</span><span className="detail-value">{detailItem.PrecioCosto != null && Number(detailItem.PrecioCosto) > 0 ? formatCurrency(detailItem.PrecioCosto) : '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Margen</span><span className="detail-value">{_margenPorcentaje(detailItem.MargenGanancia ?? 0.5)}</span></div>
          <div className="detail-item"><span className="detail-label">Precio de venta</span><span className="detail-value">{formatCurrency(detailItem.Precio)}</span></div>
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
          <div className="form-group"><label className="form-label">Costo del servicio</label>
            <input name="PrecioCosto" type="number" min="0" step="0.01" className={`form-control ${fieldError('PrecioCosto') ? 'is-error' : ''}`} value={formData.PrecioCosto} onChange={handleChange} onBlur={handleBlur} placeholder="0" />
            {fieldError('PrecioCosto') && <p className="form-error">{fieldError('PrecioCosto')}</p>}
            <p className="form-hint">Lo que le cuesta al taller prestarlo.</p>
          </div>
          <div className="form-group"><label className="form-label">Margen de ganancia (%)</label>
            {/* PORCENTAJE entero, como lo lee el taller: el % va dentro del campo
                para que la unidad no se pierda de vista al teclear. */}
            <div className="relative">
              <input name="MargenGanancia" type="number" min="1" max="100" step="1" inputMode="numeric" className={`form-control pr-2xl ${fieldError('MargenGanancia') ? 'is-error' : ''}`} value={formData.MargenGanancia} onChange={handleChange} onBlur={handleBlur} placeholder="50" />
              <span className="pointer-events-none absolute right-md top-1/2 -translate-y-1/2 text-body font-semibold text-text-muted">%</span>
            </div>
            {fieldError('MargenGanancia') && <p className="form-error">{fieldError('MargenGanancia')}</p>}
          </div>
          {/* El precio de venta NO es un campo: lo calcula el servidor. Se muestra
              para no guardar a ciegas, con la misma formula que la API. */}
          <div className="form-group span-2">
            <div className="flex flex-wrap items-center justify-between gap-md rounded-xl border border-border bg-surface-raised px-lg py-md">
              <span className="text-body font-semibold text-text-muted">Precio de venta (IVA 19 % incluido)</span>
              <span className="text-h3 font-bold text-primary">
                {_previewVenta(formData.PrecioCosto, formData.MargenGanancia) != null
                  ? formatCurrency(_previewVenta(formData.PrecioCosto, formData.MargenGanancia))
                  : '—'}
              </span>
            </div>
            <p className="form-hint">Se calcula en el servidor: costo ÷ margen + 19 % del costo.</p>
          </div>
          <div className="form-group span-2"><label className="form-label">Precio a mano (solo si no hay costo)</label>
            <input name="Precio" type="number" min="0" step="0.01" className={`form-control ${fieldError('Precio') ? 'is-error' : ''}`} value={formData.Precio} onChange={handleChange} onBlur={handleBlur} placeholder="0" />
            {fieldError('Precio') && <p className="form-error">{fieldError('Precio')}</p>}
            <p className="form-hint">Se ignora si informas un costo: ahí manda la fórmula.</p>
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

