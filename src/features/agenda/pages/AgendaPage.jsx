import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { MdAdd, MdVisibility, MdEdit, MdAssignment, MdEventBusy, MdEventRepeat, MdDeleteForever } from 'react-icons/md';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import { useBorradoReal } from '../../../shared/hooks/useBorradoReal.js';
import { agendaService } from '../services/agendaService.js';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import EliminarRealModal from '../../../shared/components/EliminarRealModal/EliminarRealModal.jsx';
import { fetchAgenda, createCita, updateCita, toggleCitaEstado, generarOrdenDeCita, cancelarCita, deleteCita } from '../slices/agendaSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import ConfirmDialog from '../../../shared/components/ConfirmDialog/ConfirmDialog.jsx';
import { useToast } from '../../../shared/components/Toast/ToastContext.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { filterItems, sortNewestFirst, formatDate } from '../../../shared/utils/helpers.js';
import api from '../../../shared/services/api.js';
import './AgendaPage.css';

const EMPTY_CITA  = { Id_Cliente: '', Id_Vehiculo: '', id_empleado: '', FechaAgendamiento: '', Hora: '', DuracionEstimadaMin: '60' };

const ESTADO_CITA_STYLE = {
  Pendiente:  { bg: '#eff6ff', fg: '#1d4ed8', label: 'Pendiente' },
  Confirmada: { bg: '#ecfeff', fg: '#0e7490', label: 'Confirmada' },
  Atendida:   { bg: '#f0fdf4', fg: '#15803d', label: 'Atendida' },
  Cancelada:  { bg: '#fef2f2', fg: '#b91c1c', label: 'Cancelada' },
  NoAsistio:  { bg: '#fefce8', fg: '#a16207', label: 'No asistió' },
};
function CitaEstadoBadge({ estado }) {
  const s = ESTADO_CITA_STYLE[estado] || ESTADO_CITA_STYLE.Pendiente;
  return <span style={{ background: s.bg, color: s.fg, padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>{s.label}</span>;
}
const CITA_CANCELABLE = (estado) => ['Pendiente', 'Confirmada'].includes(estado || 'Pendiente');
const EMPTY_ORDEN = { FechaIngreso: '', FechaEntrega: '', Diagnostico: '', Kilometraje: '' };
const TODAY = new Date().toISOString().split('T')[0];
const toMinHelper = (h) => { const [hh, mm] = String(h).split(':').map(Number); return hh * 60 + mm; };

export default function AgendaPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { items, loading, actionLoading } = useSelector(s => s.agenda);
  const puedeCrear   = usePermiso('AGENDA.REGISTRAR');
  const puedeEditar  = usePermiso('AGENDA.EDITAR');
  const puedeToggle  = usePermiso('AGENDA.CAMBIAR_ESTADO');
  const esSuperadmin = useSelector(s => s.auth.empleado?.EsSuperAdmin === true);
  const del = useBorradoReal(agendaService, { entidadLabel: 'cita', onDeleted: () => dispatch(fetchAgenda()) });
  const [clientes, setClientes]   = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [novedades, setNovedades] = useState([]);
  const [confirmCancelar, setConfirmCancelar] = useState(null); // cita a cancelar (ConfirmDialog)
  const [confirmEliminar, setConfirmEliminar] = useState(null); // cita cancelada a eliminar (ConfirmDialog)
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [empleadoFilter, setEmpleadoFilter] = useState('');
  const [pageSize, setPageSize]         = useState(5);
  const [detailId, setDetailId]       = useState(null);
  const [formData, setFormData]       = useState(EMPTY_CITA);
  const [editingId, setEditingId]     = useState(null);
  const [showForm, setShowForm]       = useState(false);
  const [formError, setFormError]     = useState('');
  const [ordenData, setOrdenData]     = useState(EMPTY_ORDEN);
  const [showOrdenModal, setShowOrdenModal] = useState(false);
  const [ordenCitaId, setOrdenCitaId] = useState(null);
  const [ordenError, setOrdenError]   = useState('');
  const [ordenVehiculoKm, setOrdenVehiculoKm] = useState(null); // km actual del vehículo (odómetro)
  const [horario, setHorario] = useState({ apertura: '08:00', cierre: '18:00', diasLaborales: [1, 2, 3, 4, 5, 6] });

  useEffect(() => {
    dispatch(fetchAgenda());
    api.get('/api/agenda/horario').then(r => { const h = r.data?.data || r.data; if (h?.apertura) setHorario(h); }).catch(() => {});
    api.get('/api/clientes').then(r => setClientes(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/vehiculos').then(r => setVehiculos(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/empleados').then(r => setEmpleados(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/novedades').then(r => {
      setNovedades(r.data?.data || r.data || []);
    }).catch(() => {});
  }, [dispatch]);

  // ── Novedades por FECHA (no solo "hoy") ──────────────────────────────
  // Bloquea asignar un empleado que tenga una novedad que cubra la fecha del
  // agendamiento, aunque sea futura. Si no hay FechaRealizacion, la novedad se
  // considera de un solo día (= Fecha_Novedad).
  const fechaEnNovedad = (n, ymd) => {
    const inicio = (n.Fecha_Novedad || '').split('T')[0];
    const fin    = (n.FechaRealizacion || '').split('T')[0] || inicio;
    return !!inicio && ymd >= inicio && ymd <= fin;
  };
  const empleadosBloqueadosEnFecha = (ymd) => new Set(
    (ymd ? novedades : [])
      .filter(n => n.Estado !== 0 && n.Estado !== false && fechaEnNovedad(n, ymd))
      .map(n => String(n.id_empleado ?? n.Id_Empleado))
  );

  const esActivo = (x) => x?.Estado !== false && x?.Estado !== 0; // excluye inactivos (B4)
  const vehiculosFiltered = (formData.Id_Cliente
    ? vehiculos.filter(v => String(v.Id_Cliente) === String(formData.Id_Cliente))
    : vehiculos
  ).filter(esActivo);

  // Opciones de hora dentro del horario de atención (cada 30 min, apertura→cierre inclusive).
  const DIAS_NOMBRE = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' };
  const horaOptions = (() => {
    const ap = toMinHelper(horario.apertura), ci = toMinHelper(horario.cierre);
    const out = [];
    for (let t = ap; t <= ci && !Number.isNaN(t); t += 30) out.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
    return out;
  })();
  const diasLaboralesLabel = (horario.diasLaborales || []).map(d => DIAS_NOMBRE[d]).join(', ');
  const esDiaLaboral = (ymd) => { if (!ymd) return true; const js = new Date(`${ymd}T12:00:00`).getDay(); const iso = js === 0 ? 7 : js; return (horario.diasLaborales || []).includes(iso); };

  // Feedback proactivo de horario: marca como ocupadas las franjas que chocarían con otra
  // cita del mismo empleado ese día, según la duración estimada elegida. La fuente de verdad
  // sigue siendo el backend (assertSinConflicto), esto solo evita que el usuario elija a ciegas.
  const duracionActual = Number(formData.DuracionEstimadaMin) || 60;
  const citasDelDiaEmpleado = formData.id_empleado && formData.FechaAgendamiento
    ? items.filter(c =>
        String(c.id_empleado ?? c.Id_Empleado) === String(formData.id_empleado) &&
        (c.FechaAgendamiento || '').split('T')[0] === formData.FechaAgendamiento &&
        !['Cancelada', 'NoAsistio'].includes(c.EstadoCita || 'Pendiente') &&
        (c.Id_Agenda ?? c.id) !== editingId
      )
    : [];
  const horaOcupada = (h) => {
    const inicio = toMinHelper(h);
    const fin = inicio + duracionActual;
    return citasDelDiaEmpleado.some(c => {
      const cIni = toMinHelper(c.Hora);
      const cFin = cIni + Number(c.DuracionEstimadaMin || 60);
      return inicio < cFin && cIni < fin;
    });
  };
  // Validación de fecha EN TIEMPO REAL (se recalcula al cambiar el campo). Mensajes en español.
  const fechaError = (() => {
    const f = formData.FechaAgendamiento;
    if (!f) return '';
    if (f < TODAY) return 'La fecha no puede ser en el pasado.';
    if (!esDiaLaboral(f)) return 'El taller no atiende ese día.';
    return '';
  })();

  // Empleados con novedad en la FECHA elegida del agendamiento (o hoy si aún no
  // se elige fecha). Bloquea asignar a alguien que estará ausente ese día.
  const empleadosBloqueados = empleadosBloqueadosEnFecha(formData.FechaAgendamiento || TODAY);

  // Validez de la cita en tiempo real: habilita "Guardar" solo cuando está completa
  // y sin conflictos (fecha válida y empleado sin novedad en esa fecha).
  const citaValida = !!formData.Id_Cliente && !!formData.Id_Vehiculo && !!formData.id_empleado
    && !!formData.FechaAgendamiento && !!formData.Hora
    && !fechaError && !empleadosBloqueados.has(String(formData.id_empleado));

  // Se incluye el Documento en la etiqueta (no solo el Nombre) para poder distinguir
  // clientes/empleados que comparten el mismo nombre.
  const clientesOpts  = clientes.filter(esActivo).map(c => ({ value: String(c.Id_Cliente), label: `${c.Nombre} — ${c.Documento}` }));
  const vehiculosOpts = vehiculosFiltered.map(v => ({ value: String(v.Id_Vehiculo), label: `${v.Placa} — ${v.Modelo}` }));
  const empleadosOpts = empleados.filter(esActivo).map(e => {
    const id = String(e.Id_Empleado ?? e.id_empleado);
    const conNovedad = empleadosBloqueados.has(id);
    return { value: id, label: `${e.Nombre} — ${e.Documento}${conNovedad ? ' — Con novedad' : ''}`, disabled: conNovedad };
  });

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    if (empleadoFilter) list = list.filter(i => String(i.id_empleado || i.Id_Empleado) === empleadoFilter);
    return sortNewestFirst(filterItems(list, search, ['cliente', 'vehiculo', 'Cliente', 'Vehiculo']), 'Id_Agenda');
  })();

  // Derivado de `items` en cada render (no un snapshot congelado): así el modal de
  // detalle refleja en tiempo real el EstadoCita real (ej. tras cancelarla).
  const detailItem = detailId ? items.find(i => (i.Id_Agenda ?? i.id) === detailId) || null : null;

  const openCreate = () => {
    setFormData({ ...EMPTY_CITA, FechaAgendamiento: new Date().toISOString().split('T')[0] });
    setEditingId(null); setFormError(''); setShowForm(true);
  };
  // Reagendar una cita cancelada: precarga cliente/vehículo/empleado en el formulario de
  // "Nueva cita" (sin volver a registrar esos datos desde cero) dejando fecha/hora en
  // blanco para elegir un horario nuevo. Es una cita NUEVA -- la cancelada queda como
  // registro histórico y no se reutiliza (su EstadoCita es un estado terminal).
  const handleReagendar = (item) => {
    setDetailId(null);
    setFormData({
      Id_Cliente: item.Id_Cliente || '',
      Id_Vehiculo: item.Id_Vehiculo || '',
      id_empleado: item.id_empleado || item.Id_Empleado || '',
      FechaAgendamiento: new Date().toISOString().split('T')[0],
      Hora: '',
      DuracionEstimadaMin: String(item.DuracionEstimadaMin ?? 60),
    });
    setEditingId(null); setFormError(''); setShowForm(true);
  };
  const handleEliminarCancelada = async () => {
    if (!confirmEliminar) return;
    const id = confirmEliminar.Id_Agenda ?? confirmEliminar.id;
    const r = await dispatch(deleteCita(id));
    setConfirmEliminar(null);
    if (!r.error) { setDetailId(null); addToast({ type: 'success', message: 'Cita eliminada.' }); }
    else addToast({ type: 'error', message: r.payload || 'No se pudo eliminar la cita.' });
  };
  const openEdit = (item) => {
    setFormData({
      Id_Cliente: item.Id_Cliente || '',
      Id_Vehiculo: item.Id_Vehiculo || '',
      id_empleado: item.id_empleado || item.Id_Empleado || '',
      FechaAgendamiento: item.FechaAgendamiento ? item.FechaAgendamiento.split('T')[0] : '',
      Hora: item.Hora || '',
      DuracionEstimadaMin: String(item.DuracionEstimadaMin ?? 60),
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
    if (fechaError) { setFormError(fechaError); return; }
    if (empleadosBloqueados.has(String(formData.id_empleado))) {
      setFormError('El empleado seleccionado tiene una novedad en esa fecha y no puede ser asignado.'); return;
    }
    const dur = Number(formData.DuracionEstimadaMin);
    const payload = { ...formData, DuracionEstimadaMin: Number.isInteger(dur) && dur > 0 ? dur : 60 };
    const action = editingId ? updateCita({ id: editingId, data: payload }) : createCita(payload);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); dispatch(fetchAgenda()); }
    else setFormError(result.payload || 'Error al guardar.');
  };

  const openGenerarOrden = (item) => {
    setOrdenCitaId(item.Id_Agenda || item.id);
    // Precarga el km con el del vehículo (odómetro). El mecánico puede subirlo.
    const veh = vehiculos.find(v => String(v.Id_Vehiculo) === String(item.Id_Vehiculo));
    const kmActual = veh && veh.Kilometraje != null ? Number(veh.Kilometraje) : null;
    setOrdenVehiculoKm(kmActual);
    // La fecha de ingreso de la orden ES la fecha de la cita de origen (no editable):
    // la orden nace de esa cita. El backend la fija autoritativamente igual.
    const fechaCita = (item.FechaAgendamiento || '').split('T')[0] || new Date().toISOString().split('T')[0];
    setOrdenData({ ...EMPTY_ORDEN, FechaIngreso: fechaCita, Kilometraje: kmActual != null ? String(kmActual) : '' });
    setOrdenError(''); setShowOrdenModal(true);
  };
  const handleOrdenChange = e => setOrdenData(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleOrdenSubmit = async (e) => {
    e.preventDefault();
    if (!ordenData.FechaIngreso || !ordenData.FechaEntrega || !ordenData.Diagnostico || !ordenData.Kilometraje) {
      setOrdenError('Completa todos los campos.'); return;
    }
    const km = Number(ordenData.Kilometraje);
    if (!Number.isInteger(km) || km < 0) { setOrdenError('El kilometraje debe ser un entero mayor o igual a 0.'); return; }
    if (ordenVehiculoKm != null && km < ordenVehiculoKm) {
      setOrdenError(`El kilometraje no puede ser menor al último registrado del vehículo (${ordenVehiculoKm.toLocaleString('es-CO')} km).`); return;
    }
    const result = await dispatch(generarOrdenDeCita({ id: ordenCitaId, data: ordenData }));
    if (!result.error) {
      setShowOrdenModal(false);
      addToast({ type: 'success', message: 'Orden de trabajo generada exitosamente.' });
      dispatch(fetchAgenda());
      // Item 16: redirigir a la orden recién creada (Ordenes la abre por el state).
      const nuevaId = result.payload?.Id_Orden ?? result.payload?.data?.Id_Orden ?? result.payload?.id;
      navigate('/ordenes', nuevaId ? { state: { openOrdenId: nuevaId } } : undefined);
    }
    else setOrdenError(result.payload || 'Error al generar orden.');
  };

  const doCancelar = async () => {
    if (!confirmCancelar) return;
    const r = await dispatch(cancelarCita(confirmCancelar.Id_Agenda || confirmCancelar.id));
    setConfirmCancelar(null);
    if (!r.error) { addToast({ type: 'success', message: 'Cita cancelada.' }); dispatch(fetchAgenda()); }
    else addToast({ type: 'error', message: r.payload || 'No se pudo cancelar la cita.' });
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
    { key: 'EstadoCita', label: 'Estado cita', render: v => <CitaEstadoBadge estado={v || 'Pendiente'} /> },
    { key: 'Estado', label: 'Activa', render: v => <StatusBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => {
        const estadoCita = row.EstadoCita || 'Pendiente';
        const atendida = estadoCita === 'Atendida';
        return (
          <div className="table-actions">
            <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleCitaEstado({ id: row.Id_Agenda || row.id, Estado: row.Estado === 1 ? 0 : 1 }))} disabled={!puedeToggle} />
            <button className="btn btn--ghost btn--icon btn--sm" title="Ver detalle" onClick={() => setDetailId(row.Id_Agenda ?? row.id)}><MdVisibility size={17} /></button>
            <button className="btn btn--ghost btn--icon btn--sm" title="Editar" disabled={!puedeEditar || atendida} onClick={() => openEdit(row)}><MdEdit size={17} /></button>
            <button className="btn btn--ghost btn--icon btn--sm agenda-order-btn" title="Generar orden" disabled={atendida || estadoCita === 'Cancelada'} onClick={() => openGenerarOrden(row)}><MdAssignment size={17} /></button>
            {CITA_CANCELABLE(estadoCita) && (
              <button className="btn btn--ghost btn--icon btn--sm" title="Cancelar cita" disabled={!puedeToggle} onClick={() => setConfirmCancelar(row)}><MdEventBusy size={17} /></button>
            )}
            {esSuperadmin && (
              <button className="btn btn--ghost btn--icon btn--sm btn--danger-ghost" title="Eliminar cita definitivamente (superadmin)" onClick={() => del.open(row.Id_Agenda ?? row.id)}><MdDeleteForever size={17} /></button>
            )}
          </div>
        );
      }
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
        <Table columns={columns} rowKey="Id_Agenda" data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron citas" />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailId(null)} title="Detalle de la cita" size="md">
        {detailItem && <div>
          <div className="detail-grid">
            <div className="detail-item"><span className="detail-label">Cliente</span><span className="detail-value">{detailItem.Cliente || getClienteNombre(detailItem.Id_Cliente)}</span></div>
            <div className="detail-item"><span className="detail-label">Vehículo</span><span className="detail-value">{detailItem.Vehiculo || getVehiculoPlaca(detailItem.Id_Vehiculo)}</span></div>
            <div className="detail-item"><span className="detail-label">Empleado</span><span className="detail-value">{detailItem.Empleado || getEmpleadoNombre(detailItem.id_empleado || detailItem.Id_Empleado)}</span></div>
            <div className="detail-item"><span className="detail-label">Fecha</span><span className="detail-value">{formatDate(detailItem.FechaAgendamiento)}</span></div>
            <div className="detail-item"><span className="detail-label">Hora</span><span className="detail-value">{detailItem.Hora}</span></div>
            <div className="detail-item"><span className="detail-label">Estado de la cita</span><span className="detail-value"><CitaEstadoBadge estado={detailItem.EstadoCita || 'Pendiente'} /></span></div>
            <div className="detail-item"><span className="detail-label">Activa</span><span className="detail-value"><StatusBadge estado={detailItem.Estado} /></span></div>
          </div>
          {detailItem.EstadoCita === 'Cancelada' && (
            <div className="u-mt-lg" style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn--primary" disabled={!puedeCrear} onClick={() => handleReagendar(detailItem)}>
                <MdEventRepeat size={18} />Reagendar
              </button>
              <button className="btn btn--danger" disabled={!puedeToggle} onClick={() => setConfirmEliminar(detailItem)}>
                <MdDeleteForever size={18} />Eliminar por completo
              </button>
            </div>
          )}
        </div>}
      </Modal>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar cita' : 'Nueva cita'} size="md"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading || !citaValida}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
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
            {formData.id_empleado && empleadosBloqueados.has(String(formData.id_empleado)) && (
              <p className="novedad-warning">⚠ Este empleado tiene una novedad en la fecha seleccionada y no puede ser asignado.</p>
            )}
          </div>
          <div className="form-group"><label className="form-label">Fecha de agendamiento <span className="required">*</span></label><input name="FechaAgendamiento" type="date" className={`form-control ${fechaError ? 'is-error' : ''}`} value={formData.FechaAgendamiento} onChange={handleChange} min={TODAY} />
            {fechaError && <p className="form-error">{fechaError}</p>}
          </div>
          <div className="form-group"><label className="form-label">Hora <span className="required">*</span></label>
            <select name="Hora" className="form-control" value={formData.Hora} onChange={handleChange}>
              <option value="">Seleccionar hora...</option>
              {(() => {
                const esHoy  = formData.FechaAgendamiento === TODAY;
                const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
                return horaOptions.map(h => {
                  const pasada  = esHoy && toMinHelper(h) <= nowMin;
                  const ocupada = h !== formData.Hora && horaOcupada(h);
                  const bloqueada = pasada || ocupada;
                  return <option key={h} value={h} disabled={bloqueada}>{h}{pasada ? ' (pasada)' : ocupada ? ' (ocupado)' : ''}</option>;
                });
              })()}
            </select>
            <p className="form-hint">Atención: {horario.apertura}–{horario.cierre} · {diasLaboralesLabel}</p>
            {formData.id_empleado && formData.FechaAgendamiento && !formData.Hora && citasDelDiaEmpleado.length > 0 && (
              <p className="form-hint">Este empleado ya tiene {citasDelDiaEmpleado.length} cita(s) ese día; las horas marcadas "(ocupado)" chocan con la duración estimada.</p>
            )}
          </div>
          <div className="form-group"><label className="form-label">Duración estimada (min)</label>
            <input name="DuracionEstimadaMin" type="number" min="1" step="15" className="form-control" value={formData.DuracionEstimadaMin} onChange={handleChange} placeholder="60" />
            <p className="form-hint">Evita solapar al mismo empleado. Por defecto 60 min.</p>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showOrdenModal} onClose={() => setShowOrdenModal(false)} title="Generar orden de trabajo" size="md"
        footer={<><button className="btn btn--outline" onClick={() => setShowOrdenModal(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleOrdenSubmit} disabled={actionLoading}>{actionLoading ? 'Generando...' : 'Generar orden'}</button></>}
      >
        {ordenError && <div className="form-error-box">{ordenError}</div>}
        <form className="form-grid" onSubmit={handleOrdenSubmit} noValidate>
          <div className="form-group"><label className="form-label">Fecha de ingreso</label><input type="text" className="form-control" value={ordenData.FechaIngreso ? formatDate(ordenData.FechaIngreso) : '—'} readOnly disabled title="Tomada de la fecha de la cita; no editable" /><p className="form-hint">Es la fecha de la cita de origen.</p></div>
          <div className="form-group"><label className="form-label">Fecha de entrega <span className="required">*</span></label><input name="FechaEntrega" type="date" className="form-control" value={ordenData.FechaEntrega} onChange={handleOrdenChange} min={ordenData.FechaIngreso || TODAY} /></div>
          <div className="form-group span-2"><label className="form-label">Diagnóstico <span className="required">*</span></label><textarea name="Diagnostico" className="form-control" value={ordenData.Diagnostico} onChange={handleOrdenChange} rows={3} maxLength={500} placeholder="Describe el diagnóstico..." /></div>
          <div className="form-group span-2"><label className="form-label">Kilometraje <span className="required">*</span></label><input name="Kilometraje" type="number" min={ordenVehiculoKm ?? 0} className="form-control" value={ordenData.Kilometraje} onChange={handleOrdenChange} placeholder="km actuales del vehículo" />{ordenVehiculoKm != null && <p className="form-hint">Último registrado del vehículo: {ordenVehiculoKm.toLocaleString('es-CO')} km. No puede ser menor.</p>}</div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmCancelar}
        onClose={() => setConfirmCancelar(null)}
        onConfirm={doCancelar}
        title="Cancelar cita"
        message="¿Cancelar esta cita? El vehículo quedará libre para reagendar."
        confirmLabel="Sí, cancelar"
        danger
        loading={actionLoading}
      />

      <ConfirmDialog
        isOpen={!!confirmEliminar}
        onClose={() => setConfirmEliminar(null)}
        onConfirm={handleEliminarCancelada}
        title="Eliminar cita cancelada"
        message="Esta acción borra la cita de forma definitiva y no se puede deshacer."
        confirmLabel="Eliminar definitivamente"
        danger
        loading={actionLoading}
      />

      <EliminarRealModal isOpen={del.isOpen} onClose={del.close} entidadLabel="cita"
        preview={del.preview} loadingPreview={del.loadingPreview} deleting={del.deleting} error={del.error} onConfirm={del.confirm} />
    </div>
  );
}

