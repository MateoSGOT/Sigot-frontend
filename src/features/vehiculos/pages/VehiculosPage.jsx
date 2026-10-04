import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit, MdDeleteForever } from 'react-icons/md';
import { useBorradoReal } from '../../../shared/hooks/useBorradoReal.js';
import { vehiculosService } from '../services/vehiculosService.js';
import EliminarRealModal from '../../../shared/components/EliminarRealModal/EliminarRealModal.jsx';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { createVehiculo, updateVehiculo, toggleVehiculoEstado } from '../slices/vehiculosSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import api from '../../../shared/services/api.js';

const RULES = {
  Placa:      V.placa,
  Color:      (v) => V.maxLen(v, 30, 'El color'),
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

// El VIN se retiró de la interfaz del taller (ya no se pide ni se muestra). No se envía
// en el payload: la API lo tiene como opcional (VIN String? @unique), así que omitirlo es
// válido y los vehículos que ya lo tenían guardado lo conservan intacto en la BD.
const EMPTY = { Placa: '', Anio: '', Color: '', Id_Cliente: '', Kilometraje: '' };

export default function VehiculosPage() {
  const dispatch = useDispatch();
  const { actionLoading } = useSelector(s => s.vehiculos);
  const puedeCrear   = usePermiso('VEHICULOS.REGISTRAR');
  const puedeEditar  = usePermiso('VEHICULOS.EDITAR');
  const puedeToggle  = usePermiso('VEHICULOS.CAMBIAR_ESTADO');
  const esSuperadmin = useSelector(s => s.auth.empleado?.EsSuperAdmin === true);
  const [clientes, setClientes] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize] = useState(5);
  // Estado del listado SERVER-SIDE (mismo patrón que RepuestosPage).
  const [page, setPage]         = useState(1);
  const [rows, setRows]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);
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
      const r = await api.get(`/api/vehiculos?${params.toString()}`);
      // Estado viene como booleano crudo de Postgres -- ToggleSwitch compara === 1.
      setRows((r.data?.data || []).map(x => ({ ...x, Estado: x.Estado === true ? 1 : x.Estado === false ? 0 : x.Estado })));
      setTotal(r.data?.total ?? 0);
    } catch { setRows([]); setTotal(0); }
    finally { setListLoading(false); }
  }, [page, pageSize, search, statusFilter]);

  const del = useBorradoReal(vehiculosService, { entidadLabel: 'vehículo', onDeleted: fetchPage });

  useEffect(() => {
    api.get('/api/clientes').then(r => setClientes(r.data?.data || r.data || [])).catch(() => {});
  }, []);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  const onSearch  = (v) => { setSearch(v); setPage(1); };
  const onStatus  = (v) => { setStatusFilter(v); setPage(1); };
  const onPageSize = (v) => { setPageSize(v); setPage(1); };





  // Un cliente desactivado no debe poder elegirse para un vehículo NUEVO (mismo criterio
  // que ya aplica AgendaPage.jsx a su select de empleados); al editar, conserva visible el
  // cliente ya asignado aunque se haya desactivado después.
  const esActivo = (x) => x?.Estado !== false && x?.Estado !== 0;
  const clientesOpts = clientes
    .filter(c => esActivo(c) || String(c.Id_Cliente) === String(formData.Id_Cliente))
    .map(c => ({ value: String(c.Id_Cliente), label: `${c.Nombre} — ${c.Documento}` }));

  // Derivado de `rows` (la página actual) en cada render: así el modal de detalle refleja
  // en tiempo real los cambios de Estado hechos desde la tabla.
  const detailItem = detailId ? rows.find(i => i.Id_Vehiculo === detailId) || null : null;

  const openCreate = () => {
    setFormData(EMPTY); setEditingId(null); setFormError(''); reset(); setShowForm(true);
  };

  const openEdit = (item) => {
    setFormData({ Placa: item.Placa || '', Anio: item.Anio || '', Color: item.Color || '', Id_Cliente: item.Id_Cliente || '', Kilometraje: item.Kilometraje ?? '' });
    setEditingId(item.Id_Vehiculo); setFormError(''); reset();
    setShowForm(true);
  };

  const setField = (name, value, extra = {}) => {
    const next = { ...formData, [name]: value, ...extra };
    setFormData(next);
    if (touched[name] || errors[name]) revalidate(next);
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
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
    if (!result.error) { setShowForm(false); fetchPage(); }
    else setFormError(result.payload || 'No se pudo guardar el vehículo.');
  };

  const handleToggle = async (row) => {
    await dispatch(toggleVehiculoEstado({ id: row.Id_Vehiculo, Estado: row.Estado === 1 ? 0 : 1 }));
    fetchPage();
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Placa', label: 'Placa', render: v => <span className="font-semibold">{v}</span> },
    { key: 'Anio', label: 'Año' },
    { key: 'Kilometraje', label: 'Kilometraje', render: v => (v != null && v !== '' ? `${Number(v).toLocaleString('es-CO')} km` : '—') },
    { key: 'Color', label: 'Color' },
    { key: 'Cliente', label: 'Cliente' },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <ToggleSwitch checked={row.Estado === 1} onChange={() => handleToggle(row)} disabled={!puedeToggle} />
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
        <div><h1 className="page__title">Vehículos</h1><p className="page__subtitle">{total} vehículo(s) registrado(s)</p></div>
        <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nuevo vehículo</button>
      </div>
      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={onSearch}
            placeholder="Buscar por placa, color..."
            filterSlot={
              <>
                <FilterDropdown
                  statusFilter={statusFilter}
                  onStatusChange={onStatus}
                  pageSize={pageSize}
                  onPageSizeChange={onPageSize}
                />
              </>
            }
          />
        </div>
        <Table
          columns={columns}
          rowKey="Id_Vehiculo"
          data={rows}
          loading={listLoading}
          serverSide
          total={total}
          page={page}
          onPageChange={setPage}
          pageSize={pageSize}
          searchTerm={search}
          onClearSearch={() => onSearch('')}
          emptyMessage="No se encontraron vehículos"
        />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailId(null)} title="Detalle del vehículo" size="md">
        {detailItem && <div className="detail-grid">
          <div className="detail-item"><span className="detail-label">Placa</span><span className="detail-value">{detailItem.Placa}</span></div>
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

