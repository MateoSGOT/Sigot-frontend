import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit, MdDeleteForever } from 'react-icons/md';
import { useBorradoReal } from '../../../shared/hooks/useBorradoReal.js';
import { vehiculosService } from '../services/vehiculosService.js';
import EliminarRealModal from '../../../shared/components/EliminarRealModal/EliminarRealModal.jsx';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchVehiculos, createVehiculo, updateVehiculo, toggleVehiculoEstado } from '../slices/vehiculosSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { sortByStatus, sortNewestFirst, filterItems } from '../../../shared/utils/helpers.js';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import { useToast } from '../../../shared/components/Toast/ToastContext.jsx';
import api from '../../../shared/services/api.js';
import './VehiculosPage.css';

const RULES = {
  Placa:      V.placa,
  VIN:        (v) => V.maxLen(v, 30, 'El VIN'),
  Color:      (v) => V.maxLen(v, 30, 'El color'),
  Id_Marca:   (v) => V.requiredSelect(v, 'La marca'),
  Id_Modelo:  (v) => V.requiredSelect(v, 'El modelo'),
  Anio:       V.anioVehiculo,
  Id_Cliente: (v) => V.requiredSelect(v, 'El cliente'),
  // Opcional: si se llena, entero >= 0.
  Kilometraje: (v) => {
    if (v == null || String(v).trim() === '') return '';
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) return 'El kilometraje debe ser un entero mayor o igual a 0.';
    if (n > 2000000) return 'El kilometraje supera el máximo permitido (2.000.000 km).';
    return '';
  },
};

const EMPTY = { Placa: '', VIN: '', Id_Marca: '', Id_Modelo: '', Anio: '', Color: '', Id_Cliente: '', Kilometraje: '' };

export default function VehiculosPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.vehiculos);
  const puedeCrear   = usePermiso('VEHICULOS.REGISTRAR');
  const puedeEditar  = usePermiso('VEHICULOS.EDITAR');
  const puedeToggle  = usePermiso('VEHICULOS.CAMBIAR_ESTADO');
  const esSuperadmin = useSelector(s => s.auth.empleado?.EsSuperAdmin === true);
  const { addToast } = useToast();
  const del = useBorradoReal(vehiculosService, { entidadLabel: 'vehículo', onDeleted: () => dispatch(fetchVehiculos()) });
  const [marcas, setMarcas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [modelos, setModelos] = useState([]);        // modelos de la marca seleccionada
  const [modelosLoading, setModelosLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [marcaFilter, setMarcaFilter] = useState('');
  const [pageSize, setPageSize] = useState(5);
  const [detailId, setDetailId] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const { errors, touched, setErrors, revalidate, markTouched, touchAll, fieldError, isInvalid, validateNow, reset } = useFormValidation(RULES);

  useEffect(() => {
    dispatch(fetchVehiculos());
    api.get('/api/catalogos/marcas').then(r => setMarcas(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/clientes').then(r => setClientes(r.data?.data || r.data || [])).catch(() => {});
  }, [dispatch]);


  // Carga los modelos de una marca (selector dependiente). incluir = Id_Modelo actual
  // a conservar aunque esté inactivo (caso edición).
  const loadModelos = (idMarca, incluir = null) => {
    if (!idMarca) { setModelos([]); return; }
    setModelosLoading(true);
    api.get(`/api/marcas/${idMarca}/modelos`)
      .then(r => {
        const data = r.data?.data || r.data || [];
        setModelos(data.filter(m => m.Estado !== false && m.Estado !== 0) .concat(
          data.filter(m => (m.Estado === false || m.Estado === 0) && incluir != null && String(m.Id_Modelo) === String(incluir))
        ));
      })
      .catch(() => setModelos([]))
      .finally(() => setModelosLoading(false));
  };

  // Crea una marca nueva al vuelo desde el select del formulario (sin salir a la
  // pantalla de Marcas). Requiere el mismo permiso que crear vehículos (backend:
  // POST /api/marcas exige VEHICULOS.REGISTRAR).
  const handleCrearMarca = async (nombre) => {
    try {
      const r = await api.post('/api/marcas', { Nombre: nombre });
      const nueva = r.data?.data || r.data;
      setMarcas(prev => [...prev, nueva]);
      addToast({ type: 'success', message: `Marca "${nueva.Nombre}" creada.` });
      return { value: String(nueva.Id_Marca), label: nueva.Nombre };
    } catch (e) {
      addToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo crear la marca.' });
      throw e;
    }
  };

  // Crea un modelo nuevo al vuelo, dentro de la marca ya elegida, sin salir a
  // la pantalla de Marcas (antes solo Marca tenía esta opción, no Modelo).
  const handleCrearModelo = async (nombre) => {
    try {
      const r = await api.post(`/api/marcas/${formData.Id_Marca}/modelos`, { Nombre: nombre });
      const nuevo = r.data?.data || r.data;
      setModelos(prev => [...prev, nuevo]);
      addToast({ type: 'success', message: `Modelo "${nuevo.Nombre}" creado.` });
      return { value: String(nuevo.Id_Modelo), label: nuevo.Nombre };
    } catch (e) {
      addToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo crear el modelo.' });
      throw e;
    }
  };

  const marcasOpts   = marcas.map(m => ({ value: String(m.Id_Marca), label: m.Nombre }));
  const modelosOpts  = modelos.map(m => ({ value: String(m.Id_Modelo), label: m.Nombre }));
  const clientesOpts = clientes.map(c => ({ value: String(c.Id_Cliente), label: `${c.Nombre} — ${c.Documento}` }));

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    if (marcaFilter) list = list.filter(i => String(i.Id_Marca) === marcaFilter || (i.Marca && i.Marca.toLowerCase() === marcas.find(m => String(m.Id_Marca) === marcaFilter)?.Nombre?.toLowerCase()));
    list = filterItems(list, search, ['Placa', 'VIN', 'Modelo', 'Color']);
    return sortByStatus(sortNewestFirst(list, 'Id_Vehiculo'));
  })();

  // Derivado de `items` en cada render (no un snapshot congelado): así el modal de
  // detalle refleja en tiempo real los cambios de Estado hechos desde la tabla.
  const detailItem = detailId ? items.find(i => i.Id_Vehiculo === detailId) || null : null;

  const openCreate = () => {
    setFormData(EMPTY); setEditingId(null); setFormError(''); reset(); setModelos([]); setShowForm(true);
  };

  const openEdit = (item) => {
    setFormData({ Placa: item.Placa || '', VIN: item.VIN || '', Id_Marca: item.Id_Marca || '', Id_Modelo: item.Id_Modelo || '', Anio: item.Anio || '', Color: item.Color || '', Id_Cliente: item.Id_Cliente || '', Kilometraje: item.Kilometraje ?? '' });
    setEditingId(item.Id_Vehiculo); setFormError(''); reset();
    loadModelos(item.Id_Marca, item.Id_Modelo);
    setShowForm(true);
  };

  const setField = (name, value, extra = {}) => {
    const next = { ...formData, [name]: value, ...extra };
    setFormData(next);
    if (touched[name] || errors[name]) revalidate(next);
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'Id_Marca') { setField(name, value, { Id_Modelo: '' }); loadModelos(value); return; }
    setField(name, value);
  };
  const handleBlur = (e) => { markTouched(e.target.name); revalidate(formData); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateNow(formData);
    setErrors(errs); touchAll();
    if (V.hasErrors(errs)) { setFormError('Corrige los campos marcados antes de guardar.'); return; }
    setFormError('');
    const km = String(formData.Kilometraje ?? '').trim();
    const payload = { ...formData, Placa: V.normalizarPlaca(formData.Placa), Kilometraje: km === '' ? null : Number(km) };
    const action = editingId ? updateVehiculo({ id: editingId, data: payload }) : createVehiculo(payload);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); dispatch(fetchVehiculos()); }
    else setFormError(result.payload || 'No se pudo guardar el vehículo.');
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Placa', label: 'Placa', render: v => <span className="font-medium">{v}</span> },
    { key: 'VIN', label: 'VIN' },
    { key: 'Marca', label: 'Marca' },
    { key: 'Modelo', label: 'Modelo' },
    { key: 'Anio', label: 'Año' },
    { key: 'Kilometraje', label: 'Kilometraje', render: v => (v != null && v !== '' ? `${Number(v).toLocaleString('es-CO')} km` : '—') },
    { key: 'Color', label: 'Color' },
    { key: 'Cliente', label: 'Cliente' },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleVehiculoEstado({ id: row.Id_Vehiculo, Estado: row.Estado === 1 ? 0 : 1 }))} disabled={!puedeToggle} />
          <button className="btn btn--ghost btn--icon btn--sm" title="Ver" onClick={() => setDetailId(row.Id_Vehiculo)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" title="Editar" disabled={!puedeEditar} onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          {esSuperadmin && (
            <button className="btn btn--ghost btn--icon btn--sm btn--danger-ghost" title="Eliminar definitivamente" onClick={() => del.open(row.Id_Vehiculo)}><MdDeleteForever size={17} /></button>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Vehículos</h1><p className="page__subtitle">{items.length} vehículo(s) registrado(s)</p></div>
        <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nuevo vehículo</button>
      </div>
      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por placa, VIN, modelo..."
            filterSlot={
              <>
                <select className="filter-select" value={marcaFilter} onChange={e => setMarcaFilter(e.target.value)}>
                  <option value="">Todas las marcas</option>
                  {marcas.map(m => <option key={m.Id_Marca} value={m.Id_Marca}>{m.Nombre}</option>)}
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
        <Table columns={columns} rowKey="Id_Vehiculo" data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron vehículos" />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailId(null)} title="Detalle del vehículo" size="md">
        {detailItem && <div className="detail-grid">
          <div className="detail-item"><span className="detail-label">Placa</span><span className="detail-value">{detailItem.Placa}</span></div>
          <div className="detail-item"><span className="detail-label">VIN</span><span className="detail-value">{detailItem.VIN || '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Marca</span><span className="detail-value">{detailItem.Marca || detailItem.Id_Marca}</span></div>
          <div className="detail-item"><span className="detail-label">Modelo</span><span className="detail-value">{detailItem.Modelo}</span></div>
          <div className="detail-item"><span className="detail-label">Año</span><span className="detail-value">{detailItem.Anio}</span></div>
          <div className="detail-item"><span className="detail-label">Color</span><span className="detail-value">{detailItem.Color || '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Cliente</span><span className="detail-value">{detailItem.Cliente || detailItem.Id_Cliente}</span></div>
          <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><StatusBadge estado={detailItem.Estado} /></span></div>
        </div>}
      </Modal>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar vehículo' : 'Nuevo vehículo'} size="md"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading || isInvalid(formData)}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Placa <span className="required">*</span></label>
            <input name="Placa" className={`form-control ${fieldError('Placa') ? 'is-error' : ''}`} value={formData.Placa} onChange={handleChange} onBlur={handleBlur} maxLength={10} placeholder="ABC-123" />
            {fieldError('Placa') && <p className="form-error">{fieldError('Placa')}</p>}
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Marca <span className="required">*</span></span>
              {/* Abre en pestaña nueva a propósito: gestionar marcas/modelos (activar,
                  renombrar, desactivar) sin perder lo ya llenado en este formulario. */}
              <a href="/marcas" target="_blank" rel="noopener noreferrer" className="u-hint-sm" style={{ fontWeight: 400 }}>
                Gestionar marcas ↗
              </a>
            </label>
            <SearchableSelect
              options={marcasOpts}
              value={String(formData.Id_Marca)}
              onChange={v => { setField('Id_Marca', v, { Id_Modelo: '' }); loadModelos(v); markTouched('Id_Marca'); }}
              placeholder="Seleccionar marca..."
              onCreateOption={puedeCrear ? handleCrearMarca : undefined}
              createLabel={q => `+ Crear marca "${q}"`}
            />
            {fieldError('Id_Marca') && <p className="form-error">{fieldError('Id_Marca')}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Modelo <span className="required">*</span></label>
            <SearchableSelect
              options={modelosOpts}
              value={String(formData.Id_Modelo)}
              onChange={v => { setField('Id_Modelo', v); markTouched('Id_Modelo'); }}
              placeholder={!formData.Id_Marca ? 'Primero selecciona una marca' : modelosLoading ? 'Cargando modelos...' : (modelosOpts.length ? 'Seleccionar modelo...' : 'Esta marca no tiene modelos activos')}
              disabled={!formData.Id_Marca || modelosLoading}
              onCreateOption={puedeCrear && formData.Id_Marca ? handleCrearModelo : undefined}
              createLabel={q => `+ Crear modelo "${q}"`}
            />
            {fieldError('Id_Modelo') && <p className="form-error">{fieldError('Id_Modelo')}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Año <span className="required">*</span></label>
            <input name="Anio" type="number" className={`form-control ${fieldError('Anio') ? 'is-error' : ''}`} value={formData.Anio} onChange={handleChange} onBlur={handleBlur} placeholder="2023" min="1900" max="2100" />
            {fieldError('Anio') && <p className="form-error">{fieldError('Anio')}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Kilometraje</label>
            <input name="Kilometraje" type="number" min="0" step="1" className={`form-control ${fieldError('Kilometraje') ? 'is-error' : ''}`} value={formData.Kilometraje} onChange={handleChange} onBlur={handleBlur} placeholder="Opcional (ej. 45000)" />
            {fieldError('Kilometraje') && <p className="form-error">{fieldError('Kilometraje')}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Color</label>
            <input name="Color" className={`form-control ${fieldError('Color') ? 'is-error' : ''}`} value={formData.Color} onChange={handleChange} onBlur={handleBlur} maxLength={30} placeholder="Blanco" />
            {fieldError('Color') && <p className="form-error">{fieldError('Color')}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">VIN</label>
            <input name="VIN" className={`form-control ${fieldError('VIN') ? 'is-error' : ''}`} value={formData.VIN} onChange={handleChange} onBlur={handleBlur} maxLength={30} placeholder="Número VIN" />
            {fieldError('VIN') && <p className="form-error">{fieldError('VIN')}</p>}
          </div>
          <div className="form-group span-2">
            <label className="form-label">Cliente <span className="required">*</span></label>
            <SearchableSelect
              options={clientesOpts}
              value={String(formData.Id_Cliente)}
              onChange={v => { setField('Id_Cliente', v); markTouched('Id_Cliente'); }}
              placeholder="Buscar cliente por nombre o documento..."
            />
            {fieldError('Id_Cliente') && <p className="form-error">{fieldError('Id_Cliente')}</p>}
          </div>
        </form>
      </Modal>

      <EliminarRealModal isOpen={del.isOpen} onClose={del.close} entidadLabel="vehículo"
        preview={del.preview} loadingPreview={del.loadingPreview} deleting={del.deleting} error={del.error} onConfirm={del.confirm} />
    </div>
  );
}

