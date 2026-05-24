import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit, MdAssignment } from 'react-icons/md';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchAgenda, createCita, updateCita, toggleCitaEstado, generarOrdenDeCita } from '../slices/agendaSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { filterItems, formatDate } from '../../../shared/utils/helpers.js';
import api from '../../../shared/services/api.js';
import './AgendaPage.css';

const EMPTY_CITA  = { Id_Cliente: '', Id_Vehiculo: '', id_empleado: '', FechaAgendamiento: '', Hora: '' };
const EMPTY_ORDEN = { FechaIngreso: '', FechaEntrega: '', Diagnostico: '', Kilometraje: '' };

export default function AgendaPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.agenda);
  const puedeCrear   = usePermiso('AGENDA.REGISTRAR');
  const puedeEditar  = usePermiso('AGENDA.EDITAR');
  const puedeToggle  = usePermiso('AGENDA.CAMBIAR_ESTADO');
  const [clientes, setClientes]   = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [novedadesActivas, setNovedadesActivas] = useState(new Set());
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [empleadoFilter, setEmpleadoFilter] = useState('');
  const [pageSize, setPageSize]         = useState(5);
  const [detailItem, setDetailItem]   = useState(null);
  const [formData, setFormData]       = useState(EMPTY_CITA);
  const [editingId, setEditingId]     = useState(null);
  const [showForm, setShowForm]       = useState(false);
  const [formError, setFormError]     = useState('');
  const [ordenData, setOrdenData]     = useState(EMPTY_ORDEN);
  const [showOrdenModal, setShowOrdenModal] = useState(false);
  const [ordenCitaId, setOrdenCitaId] = useState(null);
  const [ordenError, setOrdenError]   = useState('');

  useEffect(() => {
    dispatch(fetchAgenda());
    api.get('/api/clientes').then(r => setClientes(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/vehiculos').then(r => setVehiculos(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/empleados').then(r => setEmpleados(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/novedades').then(r => {
      const list = r.data?.data || r.data || [];
      const today = new Date().toISOString().split('T')[0];
      const ids = new Set(
        list
          .filter(n => {
            const inicio = n.Fecha_Novedad?.split('T')[0];
            const fin    = n.FechaRealizacion?.split('T')[0];
            return inicio && fin && today >= inicio && today <= fin;
          })
          .map(n => String(n.id_empleado || n.Id_Empleado))
      );
      setNovedadesActivas(ids);
    }).catch(() => {});
  }, [dispatch]);

  const vehiculosFiltered = formData.Id_Cliente
    ? vehiculos.filter(v => String(v.Id_Cliente) === String(formData.Id_Cliente))
    : vehiculos;

  const clientesOpts  = clientes.map(c => ({ value: String(c.Id_Cliente), label: c.Nombre }));
  const vehiculosOpts = vehiculosFiltered.map(v => ({ value: String(v.Id_Vehiculo), label: `${v.Placa} — ${v.Modelo}` }));
  const empleadosOpts = empleados.map(e => {
    const id = String(e.Id_Empleado ?? e.id_empleado);
    const conNovedad = novedadesActivas.has(id);
    return { value: id, label: `${e.Nombre}${conNovedad ? ' — Con novedad' : ''}`, disabled: conNovedad };
  });

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    if (empleadoFilter) list = list.filter(i => String(i.id_empleado || i.Id_Empleado) === empleadoFilter);
    return filterItems(list, search, ['cliente', 'vehiculo', 'Cliente', 'Vehiculo']);
  })();

  const openCreate = () => {
    setFormData({ ...EMPTY_CITA, FechaAgendamiento: new Date().toISOString().split('T')[0] });
    setEditingId(null); setFormError(''); setShowForm(true);
  };
  const openEdit = (item) => {
    setFormData({
      Id_Cliente: item.Id_Cliente || '',
      Id_Vehiculo: item.Id_Vehiculo || '',
      id_empleado: item.id_empleado || item.Id_Empleado || '',
      FechaAgendamiento: item.FechaAgendamiento ? item.FechaAgendamiento.split('T')[0] : '',
      Hora: item.Hora || '',
    });
    setEditingId(item.Id_Agenda || item.id); setFormError(''); setShowForm(true);
  };
  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(p => {
      const next = { ...p, [name]: value };
      if (name === 'Id_Cliente') next.Id_Vehiculo = '';
      return next;
    });
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.Id_Cliente || !formData.Id_Vehiculo || !formData.id_empleado || !formData.FechaAgendamiento || !formData.Hora) {
      setFormError('Completa todos los campos obligatorios.'); return;
    }
    if (novedadesActivas.has(String(formData.id_empleado))) {
      setFormError('El empleado seleccionado tiene una novedad activa y no puede ser asignado.'); return;
    }
    const action = editingId ? updateCita({ id: editingId, data: formData }) : createCita(formData);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); dispatch(fetchAgenda()); }
    else setFormError(result.payload || 'Error al guardar.');
  };

  const openGenerarOrden = (item) => {
    setOrdenCitaId(item.Id_Agenda || item.id);
    setOrdenData({ ...EMPTY_ORDEN, FechaIngreso: new Date().toISOString().split('T')[0] });
    setOrdenError(''); setShowOrdenModal(true);
  };
  const handleOrdenChange = e => setOrdenData(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleOrdenSubmit = async (e) => {
    e.preventDefault();
    if (!ordenData.FechaIngreso || !ordenData.FechaEntrega || !ordenData.Diagnostico || !ordenData.Kilometraje) {
      setOrdenError('Completa todos los campos.'); return;
    }
    const result = await dispatch(generarOrdenDeCita({ id: ordenCitaId, data: ordenData }));
    if (!result.error) { setShowOrdenModal(false); alert('Orden de trabajo generada exitosamente.'); dispatch(fetchAgenda()); }
    else setOrdenError(result.payload || 'Error al generar orden.');
  };

  const getClienteNombre  = id => clientes.find(c => String(c.Id_Cliente) === String(id))?.Nombre || `#${id}`;
  const getVehiculoPlaca  = id => vehiculos.find(v => String(v.Id_Vehiculo) === String(id))?.Placa || `#${id}`;
  const getEmpleadoNombre = id => empleados.find(e => String(e.Id_Empleado ?? e.id_empleado) === String(id))?.Nombre || `#${id}`;

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Cliente',  label: 'Cliente',  render: (v, row) => v || getClienteNombre(row.Id_Cliente) },
    { key: 'Vehiculo', label: 'Vehículo', render: (v, row) => v || getVehiculoPlaca(row.Id_Vehiculo) },
    { key: 'Empleado', label: 'Empleado', render: (v, row) => v || getEmpleadoNombre(row.id_empleado || row.Id_Empleado) },
    { key: 'FechaAgendamiento', label: 'Fecha', render: v => formatDate(v) },
    { key: 'Hora', label: 'Hora' },
    { key: 'Estado', label: 'Estado', render: v => <StatusBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" title="Ver detalle" onClick={() => setDetailItem(row)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" title="Editar" disabled={!puedeEditar} onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm agenda-order-btn" title="Generar orden" onClick={() => openGenerarOrden(row)}><MdAssignment size={17} /></button>
          <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleCitaEstado({ id: row.Id_Agenda || row.id, Estado: row.Estado === 1 ? 0 : 1 }))} disabled={!puedeToggle} />
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Agenda</h1><p className="page__subtitle">{items.length} cita(s) registrada(s)</p></div>
        <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nueva cita</button>
      </div>
      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por cliente, vehículo..."
            filterSlot={
              <>
                <select className="filter-select" value={empleadoFilter} onChange={e => setEmpleadoFilter(e.target.value)}>
                  <option value="">Todos los empleados</option>
                  {empleados.map(e => { const empId = e.Id_Empleado ?? e.id_empleado; return <option key={empId} value={empId}>{e.Nombre}</option>; })}
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
        <Table columns={columns} data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron citas" />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Detalle de la cita" size="md">
        {detailItem && <div className="detail-grid">
          <div className="detail-item"><span className="detail-label">Cliente</span><span className="detail-value">{detailItem.Cliente || getClienteNombre(detailItem.Id_Cliente)}</span></div>
          <div className="detail-item"><span className="detail-label">Vehículo</span><span className="detail-value">{detailItem.Vehiculo || getVehiculoPlaca(detailItem.Id_Vehiculo)}</span></div>
          <div className="detail-item"><span className="detail-label">Empleado</span><span className="detail-value">{detailItem.Empleado || getEmpleadoNombre(detailItem.id_empleado || detailItem.Id_Empleado)}</span></div>
          <div className="detail-item"><span className="detail-label">Fecha</span><span className="detail-value">{formatDate(detailItem.FechaAgendamiento)}</span></div>
          <div className="detail-item"><span className="detail-label">Hora</span><span className="detail-value">{detailItem.Hora}</span></div>
          <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><StatusBadge estado={detailItem.Estado} /></span></div>
        </div>}
      </Modal>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar cita' : 'Nueva cita'} size="md"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Cliente <span className="required">*</span></label>
            <SearchableSelect options={clientesOpts} value={String(formData.Id_Cliente)} onChange={v => setFormData(p => ({ ...p, Id_Cliente: v, Id_Vehiculo: '' }))} placeholder="Seleccionar cliente..." />
          </div>
          <div className="form-group">
            <label className="form-label">Vehículo <span className="required">*</span></label>
            <SearchableSelect options={vehiculosOpts} value={String(formData.Id_Vehiculo)} onChange={v => setFormData(p => ({ ...p, Id_Vehiculo: v }))} placeholder="Seleccionar vehículo..." disabled={!formData.Id_Cliente} />
          </div>
          <div className="form-group span-2">
            <label className="form-label">Empleado <span className="required">*</span></label>
            <SearchableSelect options={empleadosOpts} value={String(formData.id_empleado)} onChange={v => setFormData(p => ({ ...p, id_empleado: v }))} placeholder="Seleccionar empleado..." />
            {formData.id_empleado && novedadesActivas.has(String(formData.id_empleado)) && (
              <p className="novedad-warning">⚠ Este empleado tiene una novedad activa y no puede ser asignado.</p>
            )}
          </div>
          <div className="form-group"><label className="form-label">Fecha de agendamiento <span className="required">*</span></label><input name="FechaAgendamiento" type="date" className="form-control" value={formData.FechaAgendamiento} onChange={handleChange} /></div>
          <div className="form-group"><label className="form-label">Hora <span className="required">*</span></label><input name="Hora" type="time" className="form-control" value={formData.Hora} onChange={handleChange} /></div>
        </form>
      </Modal>

      <Modal isOpen={showOrdenModal} onClose={() => setShowOrdenModal(false)} title="Generar orden de trabajo" size="md"
        footer={<><button className="btn btn--outline" onClick={() => setShowOrdenModal(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleOrdenSubmit} disabled={actionLoading}>{actionLoading ? 'Generando...' : 'Generar orden'}</button></>}
      >
        {ordenError && <div className="form-error-box">{ordenError}</div>}
        <form className="form-grid" onSubmit={handleOrdenSubmit} noValidate>
          <div className="form-group"><label className="form-label">Fecha de ingreso <span className="required">*</span></label><input name="FechaIngreso" type="date" className="form-control" value={ordenData.FechaIngreso} onChange={handleOrdenChange} /></div>
          <div className="form-group"><label className="form-label">Fecha de entrega <span className="required">*</span></label><input name="FechaEntrega" type="date" className="form-control" value={ordenData.FechaEntrega} onChange={handleOrdenChange} /></div>
          <div className="form-group span-2"><label className="form-label">Diagnóstico <span className="required">*</span></label><textarea name="Diagnostico" className="form-control" value={ordenData.Diagnostico} onChange={handleOrdenChange} rows={3} placeholder="Describe el diagnóstico..." /></div>
          <div className="form-group span-2"><label className="form-label">Kilometraje <span className="required">*</span></label><input name="Kilometraje" type="number" min="0" className="form-control" value={ordenData.Kilometraje} onChange={handleOrdenChange} placeholder="km actuales del vehículo" /></div>
        </form>
      </Modal>
    </div>
  );
}

