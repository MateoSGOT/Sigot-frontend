import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { MdAdd, MdVisibility, MdEdit, MdAssignment, MdEventBusy, MdEventRepeat, MdDeleteForever, MdPrint, MdDeleteSweep } from 'react-icons/md';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import { useBorradoReal } from '../../../shared/hooks/useBorradoReal.js';
import { agendaService } from '../services/agendaService.js';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import EliminarRealModal from '../../../shared/components/EliminarRealModal/EliminarRealModal.jsx';
import { fetchAgenda, createCita, updateCita, generarOrdenDeCita, pagarDiagnosticoDeCita, cancelarCita, deleteCita } from '../slices/agendaSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import ConfirmDialog from '../../../shared/components/ConfirmDialog/ConfirmDialog.jsx';
import { useToast } from '../../../shared/components/Toast/ToastContext.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { filterItems, sortNewestFirst, formatDate, todayLocalYMD, formatHora12 } from '../../../shared/utils/helpers.js';
import { generarDiagnosticoPDF } from '../../../shared/utils/generarFacturaPDF.js';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh.js';
import api from '../../../shared/services/api.js';
import './AgendaPage.css';

const EMPTY_CITA  = { Id_Cliente: '', Id_Vehiculo: '', id_empleado: '', FechaAgendamiento: '', Hora: '', DuracionEstimadaMin: '60', TipoCita: 'Mantenimiento' };
const DURACION_POR_TIPO = { Diagnostico: '45', Mantenimiento: '60' };

const ESTADO_CITA_STYLE = {
  Pendiente:  { bg: '#eff6ff', fg: '#1d4ed8', label: 'Pendiente' },
  Confirmada: { bg: '#ecfeff', fg: '#0e7490', label: 'Confirmada' },
  Atendida:   { bg: '#f0fdf4', fg: '#15803d', label: 'Atendida' },
  Diagnosticada: { bg: '#f5f3ff', fg: '#6d28d9', label: 'Diagnosticada' },
  Cancelada:  { bg: '#fef2f2', fg: '#b91c1c', label: 'Cancelada' },
  NoAsistio:  { bg: '#fefce8', fg: '#a16207', label: 'No asistió' },
};
function CitaEstadoBadge({ estado }) {
  const s = ESTADO_CITA_STYLE[estado] || ESTADO_CITA_STYLE.Pendiente;
  return <span style={{ background: s.bg, color: s.fg, padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>{s.label}</span>;
}
const CITA_CANCELABLE = (estado) => ['Pendiente', 'Confirmada'].includes(estado || 'Pendiente');
const EMPTY_ORDEN = { FechaIngreso: '', FechaEntrega: '', Diagnostico: '', Kilometraje: '' };
const TODAY = todayLocalYMD();
const toMinHelper = (h) => { const [hh, mm] = String(h).split(':').map(Number); return hh * 60 + mm; };
// Fecha YMD -> hace N días (redondeado hacia arriba), para reutilizar la API de
// limpieza de agenda (que trabaja con una cantidad de días, no una fecha exacta).
const diasDesde = (ymd) => Math.max(1, Math.ceil((new Date(`${TODAY}T12:00:00`) - new Date(`${ymd}T12:00:00`)) / 86400000));
const fechaHaceNDias = (n) => { const d = new Date(`${TODAY}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };

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
  const [confirmCancelar, setConfirmCancelar] = useState(null); // cita a cancelar
  const [motivoCancelar, setMotivoCancelar] = useState('');
  const [cancelarError, setCancelarError]   = useState('');
  const [confirmEliminar, setConfirmEliminar] = useState(null); // cita cancelada a eliminar (ConfirmDialog)
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [empleadoFilter, setEmpleadoFilter] = useState('');
  const [citaEstadoFilter, setCitaEstadoFilter] = useState('todas');
  const [pageSize, setPageSize]         = useState(5);
  const [vista, setVista] = useState('tabla'); // 'tabla' | 'calendario' | 'diagnosticos'
  const [mesCal, setMesCal] = useState(() => { const d = new Date(); return { anio: d.getFullYear(), mes: d.getMonth() }; });
  const [detailId, setDetailId]       = useState(null);
  const [diaDetalle, setDiaDetalle]   = useState(null); // ymd del día expandido (vista calendario)
  const [formData, setFormData]       = useState(EMPTY_CITA);
  const [editingId, setEditingId]     = useState(null);
  const [showForm, setShowForm]       = useState(false);
  const [formError, setFormError]     = useState('');
  const [ordenData, setOrdenData]     = useState(EMPTY_ORDEN);
  const [showOrdenModal, setShowOrdenModal] = useState(false);
  const [ordenCitaId, setOrdenCitaId] = useState(null);
  const [ordenError, setOrdenError]   = useState('');
  const [ordenVehiculoKm, setOrdenVehiculoKm] = useState(null); // km actual del vehículo (odómetro)
  // Tipo/estado de la cita para la que está abierto el modal de "Generar orden" -- decide
  // si se muestra el botón "Pagar diagnóstico" (solo Diagnostico, aún no Diagnosticada).
  const [ordenCitaMeta, setOrdenCitaMeta] = useState({ tipoCita: 'Mantenimiento', estadoCita: 'Pendiente' });
  const [pagandoDiagnostico, setPagandoDiagnostico] = useState(false);
  const [editandoDiagnosticoId, setEditandoDiagnosticoId] = useState(null); // Id_Agenda cuyo diagnóstico se edita
  const [editDiagnosticoTexto, setEditDiagnosticoTexto] = useState('');
  const [editDiagnosticoError, setEditDiagnosticoError] = useState('');
  const [horario, setHorario] = useState({ apertura: '08:00', cierre: '18:00', diasLaborales: [1, 2, 3, 4, 5, 6] });
  // Limpieza de citas antiguas (superadmin). Se elige una fecha de corte exacta (no un
  // preset de "antigüedad" en días) -- por defecto, 90 días atrás -- y se convierte a
  // días para reutilizar la misma API existente (agendaService.limpieza*), que ya
  // trabaja con una cantidad de días.
  const [showLimpieza, setShowLimpieza]       = useState(false);
  const [limpiezaFecha, setLimpiezaFecha]     = useState('');
  const [limpiezaInfo, setLimpiezaInfo]       = useState(null); // { total, textoConfirmacion }
  const [limpiezaConfirm, setLimpiezaConfirm] = useState('');
  const [limpiezaError, setLimpiezaError]     = useState('');
  const [limpiezaLoading, setLimpiezaLoading] = useState(false);

  const cargarNovedades = () => api.get('/api/novedades').then(r => setNovedades(r.data?.data || r.data || [])).catch(() => {});

  useEffect(() => {
    dispatch(fetchAgenda());
    api.get('/api/agenda/horario').then(r => { const h = r.data?.data || r.data; if (h?.apertura) setHorario(h); }).catch(() => {});
    api.get('/api/clientes').then(r => setClientes(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/vehiculos').then(r => setVehiculos(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/empleados').then(r => setEmpleados(r.data?.data || r.data || [])).catch(() => {});
    cargarNovedades();
  }, [dispatch]);

  // Preview de la limpieza: recalcula cuántas citas se borrarían al abrir el modal
  // o al cambiar el período elegido.
  useEffect(() => {
    if (!showLimpieza || !limpiezaFecha) { if (showLimpieza) setLimpiezaInfo(null); return; }
    const dias = diasDesde(limpiezaFecha);
    let cancel = false;
    agendaService.limpiezaPreview(dias)
      .then(d => { if (!cancel) setLimpiezaInfo(d); })
      .catch(() => { if (!cancel) setLimpiezaInfo(null); });
    return () => { cancel = true; };
  }, [showLimpieza, limpiezaFecha]);

  // Actualización en tiempo real (pantalla clave): refresca citas + novedades cada 20s,
  // salvo con algún modal de creación/edición/cancelación/limpieza abierto (no interrumpe
  // al usuario). Las novedades entran al ciclo para que la disponibilidad se corrija sola.
  const hayEdicionAgenda = showForm || showOrdenModal || !!confirmCancelar
    || !!editandoDiagnosticoId || showLimpieza || del.isOpen;
  useAutoRefresh(() => { dispatch(fetchAgenda()); cargarNovedades(); }, { enabled: !hayEdicionAgenda });

  // ── Novedades por FECHA (no solo "hoy") ──────────────────────────────
  // Bloquea asignar un empleado que tenga una novedad que cubra la fecha del
  // agendamiento, aunque sea futura. Si no hay FechaRealizacion, la novedad se
  // considera de un solo día (= Fecha_Novedad).
  const fechaEnNovedad = (n, ymd) => {
    const inicio = (n.Fecha_Novedad || '').split('T')[0];
    const fin    = (n.FechaRealizacion || '').split('T')[0] || inicio;
    return !!inicio && ymd >= inicio && ymd <= fin;
  };
  // Solo las novedades de DÍA COMPLETO (sin rango horario) excluyen al empleado del select
  // ese día. Las novedades con rango de horas NO lo excluyen: solo bloquean esas horas
  // puntuales (ver novedadRangosDe / horaOcupada más abajo).
  const empleadosBloqueadosEnFecha = (ymd) => new Set(
    (ymd ? novedades : [])
      .filter(n => n.Estado !== 0 && n.Estado !== false && fechaEnNovedad(n, ymd) && !(n.HoraInicio && n.HoraFin))
      .map(n => String(n.id_empleado ?? n.Id_Empleado))
  );

  // Rangos horarios de las novedades activas de un empleado en una fecha (las que SÍ tienen
  // HoraInicio/HoraFin). Se usan para bloquear solo esas horas, no el día entero.
  const novedadRangosDe = (idEmpleado, ymd) => (novedades || [])
    .filter(n => n.Estado !== 0 && n.Estado !== false
      && String(n.id_empleado ?? n.Id_Empleado) === String(idEmpleado)
      && fechaEnNovedad(n, ymd) && n.HoraInicio && n.HoraFin)
    .map(n => ({ ini: toMinHelper(n.HoraInicio), fin: toMinHelper(n.HoraFin) }));

  const esActivo = (x) => x?.Estado !== false && x?.Estado !== 0; // excluye inactivos (B4)
  // Aviso EN TIEMPO REAL (no solo al guardar): el vehículo elegido tiene una orden de
  // trabajo en curso, así que no se le puede agendar otra cita hasta que se entregue.
  const vehiculoElegidoConOrden = formData.Id_Vehiculo
    ? vehiculos.find(v => String(v.Id_Vehiculo) === String(formData.Id_Vehiculo))?.TieneOrdenEnCurso
    : false;
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
  // Citas activas (no canceladas/no-asistió) de UN empleado en una fecha, excluyendo la
  // que se está editando -- parametrizado para poder revisarlo por cualquier candidato,
  // no solo el ya elegido en el formulario (ver tieneHuecoLibre más abajo).
  const citasDelDiaDe = (idEmpleado, ymd) => items.filter(c =>
    String(c.id_empleado ?? c.Id_Empleado) === String(idEmpleado) &&
    (c.FechaAgendamiento || '').split('T')[0] === ymd &&
    !['Cancelada', 'NoAsistio'].includes(c.EstadoCita || 'Pendiente') &&
    (c.Id_Agenda ?? c.id) !== editingId
  );
  const citasDelDiaEmpleado = formData.id_empleado && formData.FechaAgendamiento
    ? citasDelDiaDe(formData.id_empleado, formData.FechaAgendamiento)
    : [];
  // Rangos de novedad del empleado elegido ese día: sus horas quedan bloqueadas (pero el
  // resto del día sigue disponible).
  const novedadRangosEmpleado = formData.id_empleado && formData.FechaAgendamiento
    ? novedadRangosDe(formData.id_empleado, formData.FechaAgendamiento)
    : [];
  const horaOcupada = (h) => {
    const inicio = toMinHelper(h);
    const fin = inicio + duracionActual;
    const chocaCita = citasDelDiaEmpleado.some(c => {
      const cIni = toMinHelper(c.Hora);
      const cFin = cIni + Number(c.DuracionEstimadaMin || 60);
      return inicio < cFin && cIni < fin;
    });
    const chocaNovedad = novedadRangosEmpleado.some(r => inicio < r.fin && r.ini < fin);
    return chocaCita || chocaNovedad;
  };
  // Un empleado sin ningún hueco de `duracionActual` minutos libre esa fecha (dentro del
  // horario de atención) no debe aparecer como elegible -- de nada sirve dejarlo en la
  // lista si, al elegirlo, cada hora termina mostrando "(ocupado)".
  const tieneHuecoLibre = (idEmpleado, ymd) => {
    const citasDia = citasDelDiaDe(idEmpleado, ymd);
    const cierreMin = toMinHelper(horario.cierre);
    const hayHuecoEnHorario = horaOptions.some(h => toMinHelper(h) + duracionActual <= cierreMin);
    if (!hayHuecoEnHorario) return false;
    if (citasDia.length === 0) return true;
    const esHoy = ymd === TODAY;
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    return horaOptions.some(h => {
      if (esHoy && toMinHelper(h) <= nowMin) return false;
      const inicio = toMinHelper(h);
      const fin = inicio + duracionActual;
      if (fin > cierreMin) return false;
      return !citasDia.some(c => {
        const cIni = toMinHelper(c.Hora);
        const cFin = cIni + Number(c.DuracionEstimadaMin || 60);
        return inicio < cFin && cIni < fin;
      });
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

  // Validación de la duración estimada en tiempo real: mínima 15 min y que quepa
  // en algún horario del día (si no cabe ni empezando a la apertura, no hay hora
  // posible ese día -- hay que dividir el trabajo en varias citas). El resto del
  // "cap" (qué horas concretas quedan disponibles con esta duración) lo resuelve
  // el filtro de horaOptions más abajo, no este mensaje.
  const duracionError = (() => {
    const dur = Number(formData.DuracionEstimadaMin);
    if (!formData.DuracionEstimadaMin) return '';
    if (!Number.isFinite(dur) || dur < 15) return 'La duración mínima es de 15 minutos.';
    const minutosDisponibles = toMinHelper(horario.cierre) - toMinHelper(horario.apertura);
    if (dur > minutosDisponibles) return `Esa duración no cabe en un solo día (máximo ${minutosDisponibles} min entre apertura y cierre). Divide el trabajo en varias citas.`;
    return '';
  })();

  // Validez de la cita en tiempo real: habilita "Guardar" solo cuando está completa
  // y sin conflictos (fecha válida, duración válida y empleado sin novedad en esa fecha).
  const citaValida = !!formData.Id_Cliente && !!formData.Id_Vehiculo && !!formData.id_empleado
    && !!formData.FechaAgendamiento && !!formData.Hora
    && !fechaError && !duracionError && !empleadosBloqueados.has(String(formData.id_empleado))
    && !vehiculoElegidoConOrden;

  // Validación en tiempo real del modal "Generar orden" (diagnóstico).
  const ordenKmNum = Number(ordenData.Kilometraje);
  const ordenErrEntrega = ordenData.FechaEntrega && ordenData.FechaIngreso && ordenData.FechaEntrega < ordenData.FechaIngreso
    ? 'La fecha de entrega no puede ser anterior a la de ingreso.' : '';
  const ordenErrKm = ordenData.Kilometraje !== '' && (!Number.isInteger(ordenKmNum) || ordenKmNum < 0)
    ? 'El kilometraje debe ser un entero mayor o igual a 0.'
    : (ordenData.Kilometraje !== '' && ordenVehiculoKm != null && ordenKmNum < ordenVehiculoKm
        ? `No puede ser menor al último del vehículo (${ordenVehiculoKm.toLocaleString('es-CO')} km).` : '');
  const ordenFormInvalido = !ordenData.FechaIngreso || !ordenData.FechaEntrega
    || !ordenData.Diagnostico?.trim() || ordenData.Kilometraje === ''
    || !!ordenErrEntrega || !!ordenErrKm;

  // Se incluye el Documento en la etiqueta (no solo el Nombre) para poder distinguir
  // clientes/empleados que comparten el mismo nombre.
  const clientesOpts  = clientes.filter(esActivo).map(c => ({ value: String(c.Id_Cliente), label: `${c.Nombre} — ${c.Documento}` }));
  const vehiculosOpts = vehiculosFiltered.map(v => ({ value: String(v.Id_Vehiculo), label: `${v.Placa} — ${v.Modelo}` }));
  // Solo empleados con rol mecánico/técnico pueden asignarse a una cita (igual que
  // ya filtra el portal del cliente en /api/portal/empleados-disponibles).
  const esMecanicoOTecnico = (e) => /mec|tec/i.test(e.Rol || e.rol?.Nombre || '');
  // Con novedad en la fecha elegida: no aparece en la lista (antes solo se
  // deshabilitaba con la etiqueta "— Con novedad", pero seguía apareciendo). Tampoco
  // aparece si ya no le queda ningún hueco libre de la duración elegida ese día (evita
  // dejarlo elegible para que luego cada hora salga "(ocupado)").
  const fechaParaDisponibilidad = formData.FechaAgendamiento || TODAY;
  const empleadosOpts = empleados.filter(esActivo).filter(esMecanicoOTecnico)
    .filter(e => !empleadosBloqueados.has(String(e.Id_Empleado ?? e.id_empleado)))
    .filter(e => tieneHuecoLibre(e.Id_Empleado ?? e.id_empleado, fechaParaDisponibilidad))
    .map(e => {
      const id = String(e.Id_Empleado ?? e.id_empleado);
      return { value: id, label: `${e.Nombre} — ${e.Documento}` };
    });

  // Agrupa los 5 estados reales de la cita en los 3 baldes del filtro:
  // Pendientes (incluye Confirmada), Realizadas (Atendida) y Canceladas
  // (incluye NoAsistio).
  const bucketEstadoCita = (item) => {
    const e = item.EstadoCita || 'Pendiente';
    if (e === 'Atendida') return 2;
    if (e === 'Cancelada' || e === 'NoAsistio') return 3;
    return 1;
  };
  const CITA_ESTADO_BUCKET = { pendientes: 1, realizadas: 2, canceladas: 3 };

  // Una cita con el diagnóstico ya pagado sale de Tabla/Calendario -- vive en su propia
  // pestaña (Diagnósticos) hasta que se elimine o se genere la orden real desde ahí.
  const diagnosticos = items.filter(i => i.EstadoCita === 'Diagnosticada');

  const filtered = (() => {
    let list = items.filter(i => i.EstadoCita !== 'Diagnosticada');
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    if (empleadoFilter) list = list.filter(i => String(i.id_empleado || i.Id_Empleado) === empleadoFilter);
    if (citaEstadoFilter !== 'todas') {
      const bucket = CITA_ESTADO_BUCKET[citaEstadoFilter];
      list = list.filter(i => bucketEstadoCita(i) === bucket);
    }
    const sorted = sortNewestFirst(filterItems(list, search, ['cliente', 'vehiculo', 'Cliente', 'Vehiculo']), 'Id_Agenda');
    // Por defecto (sin filtro de estado): pendientes primero, luego realizadas, luego canceladas.
    if (citaEstadoFilter === 'todas') sorted.sort((a, b) => bucketEstadoCita(a) - bucketEstadoCita(b));
    return sorted;
  })();

  // Vista de calendario: agrupa `filtered` por día dentro del mes visible.
  // Reutiliza los mismos filtros/orden que la tabla, solo cambia cómo se
  // presenta.
  const MESES_NOMBRE = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const citasPorDia = (() => {
    const map = {};
    filtered.forEach(c => {
      const ymd = (c.FechaAgendamiento || '').split('T')[0];
      if (!ymd) return;
      (map[ymd] = map[ymd] || []).push(c);
    });
    return map;
  })();
  const celdasCalendario = (() => {
    const primerDia = new Date(mesCal.anio, mesCal.mes, 1);
    // Lunes = inicio de semana (DIAS_NOMBRE ya usa esa convención: 1=Lun..7=Dom).
    const offset = (primerDia.getDay() + 6) % 7;
    const inicio = new Date(mesCal.anio, mesCal.mes, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio); d.setDate(inicio.getDate() + i);
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
      const fechaYmd = `${y}-${m}-${dd}`;
      return {
        fecha: d,
        ymd: fechaYmd,
        enMes: d.getMonth() === mesCal.mes,
        esHoy: fechaYmd === TODAY,
        citas: (citasPorDia[fechaYmd] || []).slice().sort((a, b) => (a.Hora || '').localeCompare(b.Hora || '')),
      };
    });
  })();
  const cambiarMes = (delta) => setMesCal(p => {
    const d = new Date(p.anio, p.mes + delta, 1);
    return { anio: d.getFullYear(), mes: d.getMonth() };
  });

  // Derivado de `items` en cada render (no un snapshot congelado): así el modal de
  // detalle refleja en tiempo real el EstadoCita real (ej. tras cancelarla).
  const detailItem = detailId ? items.find(i => (i.Id_Agenda ?? i.id) === detailId) || null : null;

  const openCreate = () => {
    setFormData({ ...EMPTY_CITA, FechaAgendamiento: TODAY });
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
      FechaAgendamiento: TODAY,
      Hora: '',
      DuracionEstimadaMin: String(item.DuracionEstimadaMin ?? 60),
      TipoCita: item.TipoCita || 'Mantenimiento',
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
      TipoCita: item.TipoCita || 'Mantenimiento',
    });
    setEditingId(item.Id_Agenda || item.id); setFormError(''); setShowForm(true);
  };
  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(p => {
      const next = { ...p, [name]: value };
      if (name === 'Id_Cliente') next.Id_Vehiculo = '';
      // Al cambiar de fecha (o de empleado) la hora elegida puede quedar
      // "pasada" u "ocupada" para el nuevo día: se limpia para forzar a
      // elegir una hora válida en vez de dejar el select en un estado
      // bloqueado con un valor que ya no es seleccionable.
      if (name === 'FechaAgendamiento' || name === 'id_empleado') next.Hora = '';
      // Al cambiar el tipo de cita, ajusta la duración al default de ese tipo
      // -- solo si el usuario no la había personalizado ya (o sea, todavía
      // tiene el default del tipo anterior).
      if (name === 'TipoCita' && p.DuracionEstimadaMin === DURACION_POR_TIPO[p.TipoCita]) {
        next.DuracionEstimadaMin = DURACION_POR_TIPO[value] || p.DuracionEstimadaMin;
      }
      return next;
    });
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.Id_Cliente || !formData.Id_Vehiculo || !formData.id_empleado || !formData.FechaAgendamiento || !formData.Hora) {
      setFormError('Completa todos los campos obligatorios.'); return;
    }
    if (fechaError) { setFormError(fechaError); return; }
    if (duracionError) { setFormError(duracionError); return; }
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
    setOrdenCitaMeta({ tipoCita: item.TipoCita || 'Mantenimiento', estadoCita: item.EstadoCita || 'Pendiente' });
    // Precarga el km con el del vehículo (odómetro). El mecánico puede subirlo.
    const veh = vehiculos.find(v => String(v.Id_Vehiculo) === String(item.Id_Vehiculo));
    const kmActual = veh && veh.Kilometraje != null ? Number(veh.Kilometraje) : null;
    setOrdenVehiculoKm(kmActual);
    // La fecha de ingreso se precarga con HOY (el vehículo suele ingresar el día en que se
    // genera la orden) pero es editable desde el diagnóstico. Si la cita ya pasó por
    // "Pagar diagnóstico", se prellena la nota para no reescribir el diagnóstico.
    setOrdenData({ ...EMPTY_ORDEN, FechaIngreso: TODAY, Diagnostico: item.DiagnosticoNota || '', Kilometraje: kmActual != null ? String(kmActual) : '' });
    setOrdenError(''); setShowOrdenModal(true);
  };
  const handleOrdenChange = e => setOrdenData(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleOrdenSubmit = async (e) => {
    e.preventDefault();
    if (!ordenData.FechaIngreso || !ordenData.FechaEntrega || !ordenData.Diagnostico || !ordenData.Kilometraje) {
      setOrdenError('Completa todos los campos.'); return;
    }
    if (ordenData.FechaIngreso > ordenData.FechaEntrega) {
      setOrdenError('La fecha de entrega no puede ser anterior a la de ingreso.'); return;
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

  // "Pagar diagnóstico": registra la nota y manda la cita a la pestaña Diagnósticos, SIN
  // generar todavía la Orden_de_Trabajo real -- eso queda para cuando (si) el cliente
  // decide seguir con la reparación (botón "Generar orden de trabajo" en esa pestaña).
  const handlePagarDiagnostico = async () => {
    if (!ordenData.Diagnostico || !ordenData.Diagnostico.trim()) {
      setOrdenError('Escribe el diagnóstico antes de marcarlo como pagado.'); return;
    }
    setPagandoDiagnostico(true);
    const result = await dispatch(pagarDiagnosticoDeCita({ id: ordenCitaId, DiagnosticoNota: ordenData.Diagnostico.trim() }));
    setPagandoDiagnostico(false);
    if (!result.error) {
      setShowOrdenModal(false);
      addToast({ type: 'success', message: 'Diagnóstico pagado. La cita pasó a la pestaña Diagnósticos.' });
      dispatch(fetchAgenda());
    } else {
      setOrdenError(result.payload || 'No se pudo pagar el diagnóstico.');
    }
  };

  // Editar la nota de un diagnóstico ya pagado (pestaña Diagnósticos) -- reusa el mismo
  // endpoint de "pagar diagnóstico" (la cita se queda en Diagnosticada, solo cambia el texto).
  const openEditarDiagnostico = (row) => {
    setEditandoDiagnosticoId(row.Id_Agenda ?? row.id);
    setEditDiagnosticoTexto(row.DiagnosticoNota || '');
    setEditDiagnosticoError('');
  };
  const handleGuardarDiagnosticoEditado = async () => {
    if (!editDiagnosticoTexto.trim()) { setEditDiagnosticoError('El diagnóstico no puede quedar vacío.'); return; }
    const result = await dispatch(pagarDiagnosticoDeCita({ id: editandoDiagnosticoId, DiagnosticoNota: editDiagnosticoTexto.trim() }));
    if (!result.error) {
      setEditandoDiagnosticoId(null);
      addToast({ type: 'success', message: 'Diagnóstico actualizado.' });
      dispatch(fetchAgenda());
    } else {
      setEditDiagnosticoError(result.payload || 'No se pudo actualizar el diagnóstico.');
    }
  };

  const openCancelar = (row) => { setConfirmCancelar(row); setMotivoCancelar(''); setCancelarError(''); };
  const closeCancelar = () => { setConfirmCancelar(null); setMotivoCancelar(''); setCancelarError(''); };
  const doCancelar = async () => {
    if (!confirmCancelar) return;
    if (!motivoCancelar.trim()) { setCancelarError('Indica el motivo de la cancelación.'); return; }
    const r = await dispatch(cancelarCita({ id: confirmCancelar.Id_Agenda || confirmCancelar.id, motivo: motivoCancelar.trim() }));
    if (!r.error) { closeCancelar(); addToast({ type: 'success', message: 'Cita cancelada. Se notificó al cliente por correo.' }); dispatch(fetchAgenda()); }
    else addToast({ type: 'error', message: r.payload || 'No se pudo cancelar la cita.' });
  };

  const openLimpieza = () => { setShowLimpieza(true); setLimpiezaFecha(fechaHaceNDias(90)); setLimpiezaInfo(null); setLimpiezaConfirm(''); setLimpiezaError(''); };
  const handleLimpiezaEjecutar = async () => {
    setLimpiezaError('');
    if (!limpiezaFecha || limpiezaFecha >= TODAY) { setLimpiezaError('Elige una fecha de corte válida (anterior a hoy).'); return; }
    const dias = diasDesde(limpiezaFecha);
    if (!limpiezaConfirm.trim()) { setLimpiezaError('Escribe el texto de confirmación.'); return; }
    setLimpiezaLoading(true);
    try {
      const r = await agendaService.limpiezaEjecutar(dias, limpiezaConfirm.trim());
      setShowLimpieza(false);
      addToast({ type: 'success', message: `Se eliminaron ${r?.eliminadas ?? 0} cita(s) antigua(s).` });
      dispatch(fetchAgenda());
    } catch (e) {
      setLimpiezaError(e?.response?.data?.message || 'No se pudo ejecutar la limpieza.');
    } finally {
      setLimpiezaLoading(false);
    }
  };

  const getClienteNombre  = id => clientes.find(c => String(c.Id_Cliente) === String(id))?.Nombre || `#${id}`;
  const getVehiculoPlaca  = id => vehiculos.find(v => String(v.Id_Vehiculo) === String(id))?.Placa || `#${id}`;
  const getEmpleadoNombre = id => empleados.find(e => String(e.Id_Empleado ?? e.id_empleado) === String(id))?.Nombre || `#${id}`;

  // Imprime el diagnóstico de una cita "Diagnosticada" (PDF minimalista), enriquecido
  // con los datos de cliente/vehículo del catálogo ya cargado.
  const printDiagnostico = (row) => {
    const cli = clientes.find(c => String(c.Id_Cliente) === String(row.Id_Cliente));
    const veh = vehiculos.find(v => String(v.Id_Vehiculo) === String(row.Id_Vehiculo));
    generarDiagnosticoPDF({
      Id: row.Id_Agenda ?? row.id,
      Cliente: row.Cliente || cli?.Nombre || getClienteNombre(row.Id_Cliente),
      ClienteDoc: cli?.Documento,
      ClienteContacto: cli?.Telefono || cli?.Contacto,
      Vehiculo: row.Vehiculo || veh?.Placa || getVehiculoPlaca(row.Id_Vehiculo),
      Marca: veh?.Marca || veh?.marca?.Nombre,
      Modelo: veh?.Modelo,
      Empleado: row.Empleado || getEmpleadoNombre(row.id_empleado || row.Id_Empleado),
      Fecha: row.FechaAgendamiento,
      Diagnostico: row.DiagnosticoNota,
    });
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Cliente',  label: 'Cliente',  render: (v, row) => v || getClienteNombre(row.Id_Cliente) },
    { key: 'Vehiculo', label: 'Vehículo', render: (v, row) => v || getVehiculoPlaca(row.Id_Vehiculo) },
    { key: 'Empleado', label: 'Empleado', render: (v, row) => v || getEmpleadoNombre(row.id_empleado || row.Id_Empleado) },
    { key: 'FechaAgendamiento', label: 'Fecha', render: v => formatDate(v) },
    { key: 'Hora', label: 'Hora', render: v => formatHora12(v) },
    { key: 'TipoCita', label: 'Tipo', render: v => v === 'Diagnostico' ? 'Diagnóstico' : 'Mantenimiento' },
    { key: 'EstadoCita', label: 'Estado cita', render: v => <CitaEstadoBadge estado={v || 'Pendiente'} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => {
        const estadoCita = row.EstadoCita || 'Pendiente';
        const atendida = estadoCita === 'Atendida';
        // Una cita en estado terminal (atendida, cancelada, no asistió o ya
        // diagnosticada) no se puede editar.
        const bloqueadaEdicion = ['Atendida', 'Cancelada', 'NoAsistio', 'Diagnosticada'].includes(estadoCita);
        return (
          <div className="table-actions">
            <button className="btn btn--ghost btn--icon btn--sm" title="Ver detalle" onClick={() => setDetailId(row.Id_Agenda ?? row.id)}><MdVisibility size={17} /></button>
            <button className="btn btn--ghost btn--icon btn--sm" title="Editar" disabled={!puedeEditar || bloqueadaEdicion} onClick={() => openEdit(row)}><MdEdit size={17} /></button>
            <button className="btn btn--ghost btn--icon btn--sm agenda-order-btn" title="Generar orden" disabled={atendida || estadoCita === 'Cancelada'} onClick={() => openGenerarOrden(row)}><MdAssignment size={17} /></button>
            {CITA_CANCELABLE(estadoCita) && (
              <button className="btn btn--ghost btn--icon btn--sm" title="Cancelar cita" disabled={!puedeToggle} onClick={() => openCancelar(row)}><MdEventBusy size={17} /></button>
            )}
            {esSuperadmin && (
              <button className="btn btn--ghost btn--icon btn--sm btn--danger-ghost" title="Eliminar cita definitivamente (superadmin)" onClick={() => del.open(row.Id_Agenda ?? row.id)}><MdDeleteForever size={17} /></button>
            )}
          </div>
        );
      }
    },
  ];

  // Pestaña Diagnósticos: citas con el diagnóstico ya pagado (EstadoCita='Diagnosticada'),
  // esperando a que se decida si se convierten en una Orden_de_Trabajo real o se eliminan.
  const diagnosticosColumns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Cliente',  label: 'Cliente',  render: (v, row) => v || getClienteNombre(row.Id_Cliente) },
    { key: 'Vehiculo', label: 'Vehículo', render: (v, row) => v || getVehiculoPlaca(row.Id_Vehiculo) },
    { key: 'Empleado', label: 'Empleado', render: (v, row) => v || getEmpleadoNombre(row.id_empleado || row.Id_Empleado) },
    { key: 'FechaAgendamiento', label: 'Fecha', render: v => formatDate(v) },
    { key: 'DiagnosticoNota', label: 'Diagnóstico', render: v => <span className="diag-cell">{v || '—'}</span> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" title="Ver detalle" onClick={() => setDetailId(row.Id_Agenda ?? row.id)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" title="Imprimir diagnóstico" onClick={() => printDiagnostico(row)}><MdPrint size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" title="Editar diagnóstico" disabled={!puedeEditar} onClick={() => openEditarDiagnostico(row)}><MdEdit size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm agenda-order-btn" title="Generar orden de trabajo" disabled={!puedeCrear} onClick={() => openGenerarOrden(row)}><MdAssignment size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm btn--danger-ghost" title="Eliminar diagnóstico" disabled={!puedeToggle} onClick={() => setConfirmEliminar(row)}><MdDeleteForever size={17} /></button>
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Agenda</h1><p className="page__subtitle">{items.length} cita(s) registrada(s)</p></div>
        <div className="page__actions">
          <div className="agenda-vista-toggle">
            <button type="button" className={`agenda-vista-btn${vista === 'tabla' ? ' agenda-vista-btn--active' : ''}`} onClick={() => setVista('tabla')}>Tabla</button>
            <button type="button" className={`agenda-vista-btn${vista === 'calendario' ? ' agenda-vista-btn--active' : ''}`} onClick={() => setVista('calendario')}>Calendario</button>
            <button type="button" className={`agenda-vista-btn${vista === 'diagnosticos' ? ' agenda-vista-btn--active' : ''}`} onClick={() => setVista('diagnosticos')}>
              Diagnósticos{diagnosticos.length > 0 ? ` (${diagnosticos.length})` : ''}
            </button>
          </div>
          {esSuperadmin && (
            <button className="btn btn--outline" onClick={openLimpieza} title="Eliminar citas canceladas / no asistió antiguas">
              <MdDeleteSweep size={18} />Limpiar antiguas
            </button>
          )}
          <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nueva cita</button>
        </div>
      </div>
      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por cliente, vehículo..."
            filterSlot={
              <>
                {vista !== 'diagnosticos' && (
                  <>
                    <select className="filter-select" value={empleadoFilter} onChange={e => setEmpleadoFilter(e.target.value)}>
                      <option value="">Todos los empleados</option>
                      {empleados.filter(esMecanicoOTecnico).map(e => { const empId = e.Id_Empleado ?? e.id_empleado; return <option key={empId} value={empId}>{e.Nombre}</option>; })}
                    </select>
                    <select className="filter-select" value={citaEstadoFilter} onChange={e => setCitaEstadoFilter(e.target.value)}>
                      <option value="todas">Todas las citas</option>
                      <option value="pendientes">Pendientes</option>
                      <option value="realizadas">Realizadas</option>
                      <option value="canceladas">Canceladas</option>
                    </select>
                  </>
                )}
                {vista === 'tabla' && (
                  <FilterDropdown
                    statusFilter={statusFilter}
                    onStatusChange={setStatusFilter}
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                  />
                )}
              </>
            }
          />
        </div>
        {vista === 'tabla' && (
          <Table columns={columns} rowKey="Id_Agenda" data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron citas" />
        )}
        {vista === 'diagnosticos' && (
          <Table
            columns={diagnosticosColumns}
            rowKey="Id_Agenda"
            data={filterItems(diagnosticos, search, ['cliente', 'vehiculo', 'Cliente', 'Vehiculo'])}
            loading={loading}
            pageSize={pageSize}
            emptyMessage="No hay diagnósticos pagados pendientes de convertir en orden"
          />
        )}
        {vista === 'calendario' && (
          <div className="agenda-calendario">
            <div className="agenda-calendario__nav">
              <button type="button" className="btn btn--outline btn--sm" onClick={() => cambiarMes(-1)}>← Anterior</button>
              <span className="agenda-calendario__mes">{MESES_NOMBRE[mesCal.mes]} {mesCal.anio}</span>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => cambiarMes(1)}>Siguiente →</button>
            </div>
            <div className="agenda-calendario__grid agenda-calendario__grid--header">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                <div key={d} className="agenda-calendario__dia-nombre">{d}</div>
              ))}
            </div>
            <div className="agenda-calendario__grid">
              {celdasCalendario.map(celda => (
                <div
                  key={celda.ymd}
                  className={`agenda-calendario__celda${celda.enMes ? '' : ' agenda-calendario__celda--fuera'}${celda.esHoy ? ' agenda-calendario__celda--hoy' : ''}${celda.citas.length ? ' agenda-calendario__celda--clickable' : ''}`}
                  onClick={() => celda.citas.length && setDiaDetalle(celda.ymd)}
                  role={celda.citas.length ? 'button' : undefined}
                  tabIndex={celda.citas.length ? 0 : undefined}
                >
                  <span className="agenda-calendario__num">{celda.fecha.getDate()}</span>
                  <div className="agenda-calendario__citas">
                    {celda.citas.slice(0, 3).map(c => {
                      const s = ESTADO_CITA_STYLE[c.EstadoCita] || ESTADO_CITA_STYLE.Pendiente;
                      return (
                        <button
                          key={c.Id_Agenda ?? c.id}
                          type="button"
                          className="agenda-calendario__chip"
                          style={{ background: s.bg, color: s.fg }}
                          title={`${formatHora12(c.Hora)} · ${c.cliente || ''}`}
                          onClick={(e) => { e.stopPropagation(); setDetailId(c.Id_Agenda ?? c.id); }}
                        >
                          {formatHora12(c.Hora)} {c.cliente}
                        </button>
                      );
                    })}
                    {celda.citas.length > 3 && (
                      <span className="agenda-calendario__mas">+{celda.citas.length - 3} más</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={!!diaDetalle} onClose={() => setDiaDetalle(null)} title={diaDetalle ? `Citas del ${formatDate(diaDetalle)}` : 'Citas del día'} size="md">
        {diaDetalle && (
          (citasPorDia[diaDetalle] || []).slice().sort((a, b) => (a.Hora || '').localeCompare(b.Hora || '')).length > 0 ? (
            <div className="agenda-dia-lista">
              {citasPorDia[diaDetalle].slice().sort((a, b) => (a.Hora || '').localeCompare(b.Hora || '')).map(c => {
                const s = ESTADO_CITA_STYLE[c.EstadoCita] || ESTADO_CITA_STYLE.Pendiente;
                return (
                  <button
                    key={c.Id_Agenda ?? c.id}
                    type="button"
                    className="agenda-dia-lista__item"
                    onClick={() => { setDiaDetalle(null); setDetailId(c.Id_Agenda ?? c.id); }}
                  >
                    <span className="agenda-dia-lista__hora">{formatHora12(c.Hora)}</span>
                    <span className="agenda-dia-lista__cliente">{c.cliente}</span>
                    <span style={{ background: s.bg, color: s.fg, padding: '2px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600 }}>{s.label}</span>
                  </button>
                );
              })}
            </div>
          ) : <p className="empty-list">No hay citas ese día.</p>
        )}
      </Modal>

      <Modal isOpen={!!detailItem} onClose={() => setDetailId(null)} title="Detalle de la cita" size="md">
        {detailItem && <div>
          <div className="detail-grid">
            <div className="detail-item"><span className="detail-label">Cliente</span><span className="detail-value">{detailItem.Cliente || getClienteNombre(detailItem.Id_Cliente)}</span></div>
            <div className="detail-item"><span className="detail-label">Vehículo</span><span className="detail-value">{detailItem.Vehiculo || getVehiculoPlaca(detailItem.Id_Vehiculo)}</span></div>
            <div className="detail-item"><span className="detail-label">Empleado</span><span className="detail-value">{detailItem.Empleado || getEmpleadoNombre(detailItem.id_empleado || detailItem.Id_Empleado)}</span></div>
            <div className="detail-item"><span className="detail-label">Fecha</span><span className="detail-value">{formatDate(detailItem.FechaAgendamiento)}</span></div>
            <div className="detail-item"><span className="detail-label">Hora</span><span className="detail-value">{formatHora12(detailItem.Hora)}</span></div>
            <div className="detail-item"><span className="detail-label">Tipo de cita</span><span className="detail-value">{detailItem.TipoCita === 'Diagnostico' ? 'Diagnóstico' : 'Mantenimiento'}</span></div>
            <div className="detail-item"><span className="detail-label">Estado de la cita</span><span className="detail-value"><CitaEstadoBadge estado={detailItem.EstadoCita || 'Pendiente'} /></span></div>
            <div className="detail-item"><span className="detail-label">Activa</span><span className="detail-value"><StatusBadge estado={detailItem.Estado} /></span></div>
            {detailItem.DiagnosticoNota && (
              <div className="detail-item u-span-2"><span className="detail-label">Diagnóstico</span><span className="detail-value">{detailItem.DiagnosticoNota}</span></div>
            )}
          </div>
          {detailItem.EstadoCita === 'Cancelada' && (
            <div className="u-mt-lg" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button className="btn btn--primary" disabled={!puedeCrear} onClick={() => handleReagendar(detailItem)}>
                <MdEventRepeat size={18} />Reagendar
              </button>
              <button className="btn btn--danger" disabled={!puedeToggle} onClick={() => setConfirmEliminar(detailItem)} style={{ marginLeft: 'auto' }}>
                <MdDeleteForever size={18} />Eliminar por completo
              </button>
            </div>
          )}
          {detailItem.EstadoCita === 'Diagnosticada' && (
            <div className="u-mt-lg" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn--outline" onClick={() => printDiagnostico(detailItem)}>
                <MdPrint size={18} />Imprimir diagnóstico
              </button>
              <button className="btn btn--primary" disabled={!puedeCrear} onClick={() => { setDetailId(null); openGenerarOrden(detailItem); }}>
                <MdAssignment size={18} />Generar orden de trabajo
              </button>
              <button className="btn btn--danger" disabled={!puedeToggle} onClick={() => setConfirmEliminar(detailItem)} style={{ marginLeft: 'auto' }}>
                <MdDeleteForever size={18} />Eliminar
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
          <div className="form-group span-2"><label className="form-label">Tipo de cita</label>
            <SearchableSelect
              options={[{ value: 'Mantenimiento', label: 'Mantenimiento / reparación' }, { value: 'Diagnostico', label: 'Diagnóstico' }]}
              value={formData.TipoCita}
              onChange={v => handleChange({ target: { name: 'TipoCita', value: v } })}
            />
          </div>
          <div className="form-group span-2">
            <label className="form-label">Duración estimada (min)</label>
            <div className="agenda-duracion-row">
              <input name="DuracionEstimadaMin" type="number" min="15" step="15" className={`form-control agenda-duracion-input${duracionError ? ' is-error' : ''}`} value={formData.DuracionEstimadaMin} onChange={handleChange} placeholder="60" />
              <p className="form-hint agenda-duracion-hint">Diagnóstico 45 min · mantenimiento 60. Las horas que no alcanzan a terminar antes del cierre ({formatHora12(horario.cierre)}) no aparecerán en la lista.</p>
            </div>
            {duracionError && <p className="form-error">{duracionError}</p>}
          </div>
          <div className="form-group span-2">
            <label className="form-label">Empleado <span className="required">*</span></label>
            <SearchableSelect options={empleadosOpts} value={String(formData.id_empleado)} onChange={v => setFormData(p => ({ ...p, id_empleado: v, Hora: '' }))} placeholder="Seleccionar empleado..." />
            {formData.id_empleado && empleadosBloqueados.has(String(formData.id_empleado)) && (
              <p className="novedad-warning">⚠ Este empleado tiene una novedad en la fecha seleccionada y no puede ser asignado.</p>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Cliente <span className="required">*</span></label>
            <SearchableSelect options={clientesOpts} value={String(formData.Id_Cliente)} onChange={v => setFormData(p => ({ ...p, Id_Cliente: v, Id_Vehiculo: '' }))} placeholder="Seleccionar cliente..." />
          </div>
          <div className="form-group">
            <label className="form-label">Vehículo <span className="required">*</span></label>
            <SearchableSelect options={vehiculosOpts} value={String(formData.Id_Vehiculo)} onChange={v => setFormData(p => ({ ...p, Id_Vehiculo: v }))} placeholder="Seleccionar vehículo..." disabled={!formData.Id_Cliente} />
            {vehiculoElegidoConOrden && (
              <p className="novedad-warning">⚠ Este vehículo tiene una orden de trabajo en curso; no se le puede agendar otra cita hasta que sea entregado.</p>
            )}
          </div>
          <div className="form-group"><label className="form-label">Fecha de agendamiento <span className="required">*</span></label><input name="FechaAgendamiento" type="date" className={`form-control ${fechaError ? 'is-error' : ''}`} value={formData.FechaAgendamiento} onChange={handleChange} min={TODAY} />
            {fechaError && <p className="form-error">{fechaError}</p>}
          </div>
          <div className="form-group"><label className="form-label">Hora <span className="required">*</span></label>
            <SearchableSelect
              options={(() => {
                const esHoy  = formData.FechaAgendamiento === TODAY;
                const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
                const minToHHMM = (mins) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
                // Las horas ya pasadas del día de hoy no se muestran, y las ocupadas
                // (chocan con la duración estimada de otra cita de este empleado) se
                // excluyen por completo -- no solo se deshabilitan. Se muestra el rango
                // completo (ej. "2:00 PM – 2:45 PM") según la duración estimada elegida,
                // para que se vea cuánto tiempo va a ocupar realmente esta cita.
                return horaOptions
                  .filter(h => !(esHoy && toMinHelper(h) <= nowMin))
                  .filter(h => toMinHelper(h) + duracionActual <= toMinHelper(horario.cierre))
                  .filter(h => h === formData.Hora || !horaOcupada(h))
                  .map(h => ({ value: h, label: `${formatHora12(h)} – ${formatHora12(minToHHMM(toMinHelper(h) + duracionActual))}` }));
              })()}
              value={formData.Hora}
              onChange={v => handleChange({ target: { name: 'Hora', value: v } })}
              placeholder="Seleccionar hora..."
            />
            <p className="form-hint">Atención: {horario.apertura}–{horario.cierre} · {diasLaboralesLabel}</p>
            {formData.id_empleado && formData.FechaAgendamiento && !formData.Hora && citasDelDiaEmpleado.length > 0 && (
              <p className="form-hint">Este empleado ya tiene {citasDelDiaEmpleado.length} cita(s) ese día; las horas que chocan con su duración estimada no aparecen en la lista.</p>
            )}
          </div>
        </form>
      </Modal>

      <Modal isOpen={showOrdenModal} onClose={() => setShowOrdenModal(false)} title="Generar orden de trabajo" size="md"
        footer={<>
          <button className="btn btn--outline" onClick={() => setShowOrdenModal(false)}>Cancelar</button>
          {ordenCitaMeta.tipoCita === 'Diagnostico' && ordenCitaMeta.estadoCita !== 'Diagnosticada' && (
            <button className="btn btn--outline" onClick={handlePagarDiagnostico} disabled={pagandoDiagnostico || actionLoading} title="Registra el diagnóstico como pagado, sin generar todavía la orden de trabajo">
              {pagandoDiagnostico ? 'Guardando...' : 'Pagar diagnóstico'}
            </button>
          )}
          <button className="btn btn--primary" onClick={handleOrdenSubmit} disabled={actionLoading || ordenFormInvalido}>{actionLoading ? 'Generando...' : 'Generar orden'}</button>
        </>}
      >
        {ordenError && <div className="form-error-box">{ordenError}</div>}
        <form className="form-grid" onSubmit={handleOrdenSubmit} noValidate>
          <div className="form-group"><label className="form-label">Fecha de ingreso <span className="required">*</span></label><input name="FechaIngreso" type="date" className="form-control" value={ordenData.FechaIngreso} onChange={handleOrdenChange} max={TODAY} /><p className="form-hint">Por defecto hoy; ajústala si el vehículo ingresó otro día.</p></div>
          <div className="form-group"><label className="form-label">Fecha de entrega <span className="required">*</span></label><input name="FechaEntrega" type="date" className={`form-control ${ordenErrEntrega ? 'is-error' : ''}`} value={ordenData.FechaEntrega} onChange={handleOrdenChange} min={ordenData.FechaIngreso || TODAY} />{ordenErrEntrega && <p className="form-error">{ordenErrEntrega}</p>}</div>
          <div className="form-group span-2"><label className="form-label">Diagnóstico <span className="required">*</span></label><textarea name="Diagnostico" className="form-control" value={ordenData.Diagnostico} onChange={handleOrdenChange} rows={3} maxLength={500} placeholder="Describe el diagnóstico..." /></div>
          <div className="form-group span-2"><label className="form-label">Kilometraje <span className="required">*</span></label><input name="Kilometraje" type="number" min={ordenVehiculoKm ?? 0} className={`form-control ${ordenErrKm ? 'is-error' : ''}`} value={ordenData.Kilometraje} onChange={handleOrdenChange} placeholder="km actuales del vehículo" />{ordenErrKm && <p className="form-error">{ordenErrKm}</p>}{ordenVehiculoKm != null && <p className="form-hint">Último registrado del vehículo: {ordenVehiculoKm.toLocaleString('es-CO')} km. No puede ser menor.</p>}</div>
        </form>
      </Modal>

      <Modal isOpen={!!editandoDiagnosticoId} onClose={() => setEditandoDiagnosticoId(null)} title="Editar diagnóstico" size="sm"
        footer={<><button className="btn btn--outline" onClick={() => setEditandoDiagnosticoId(null)}>Cancelar</button><button className="btn btn--primary" onClick={handleGuardarDiagnosticoEditado} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {editDiagnosticoError && <div className="form-error-box">{editDiagnosticoError}</div>}
        <div className="form-group">
          <label className="form-label">Diagnóstico <span className="required">*</span></label>
          <textarea className="form-control" value={editDiagnosticoTexto} onChange={e => setEditDiagnosticoTexto(e.target.value)} rows={4} maxLength={500} placeholder="Describe el diagnóstico..." />
        </div>
      </Modal>

      <Modal
        isOpen={!!confirmCancelar}
        onClose={closeCancelar}
        title="Cancelar cita"
        size="sm"
        footer={<>
          <button className="btn btn--outline" onClick={closeCancelar}>Volver</button>
          <button className="btn btn--danger" onClick={doCancelar} disabled={actionLoading}>{actionLoading ? 'Cancelando...' : 'Sí, cancelar'}</button>
        </>}
      >
        {cancelarError && <div className="form-error-box">{cancelarError}</div>}
        <p className="u-mb-md">¿Cancelar esta cita? El vehículo quedará libre para reagendar y se notificará al cliente por correo.</p>
        <div className="form-group">
          <label className="form-label">Motivo de la cancelación <span className="required">*</span></label>
          <textarea
            className="form-control"
            rows={3}
            maxLength={300}
            value={motivoCancelar}
            onChange={e => { setMotivoCancelar(e.target.value); if (cancelarError) setCancelarError(''); }}
            placeholder="Ej. El técnico no estará disponible, el cliente solicitó reprogramar..."
          />
        </div>
      </Modal>

      <Modal isOpen={showLimpieza} onClose={() => setShowLimpieza(false)} title="Limpiar citas antiguas" size="sm"
        footer={<>
          <button className="btn btn--outline" onClick={() => setShowLimpieza(false)}>Cancelar</button>
          <button className="btn btn--danger" onClick={handleLimpiezaEjecutar} disabled={limpiezaLoading || !(limpiezaInfo?.total > 0) || !limpiezaConfirm.trim()}>
            {limpiezaLoading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </>}
      >
        {limpiezaError && <div className="form-error-box">{limpiezaError}</div>}
        <p className="u-mb-md">Elimina de forma definitiva las citas <strong>canceladas</strong> y <strong>no asistió</strong> más antiguas que el período elegido. Las citas atendidas se conservan (están ligadas a órdenes de trabajo).</p>
        <div className="form-group">
          <label className="form-label">Eliminar citas anteriores a</label>
          <input
            type="date"
            className="form-control"
            value={limpiezaFecha}
            max={fechaHaceNDias(1)}
            onChange={e => { setLimpiezaFecha(e.target.value); setLimpiezaConfirm(''); }}
          />
        </div>
        <p className="u-mb-md">
          {limpiezaInfo == null
            ? 'Calculando…'
            : (limpiezaInfo.total > 0
              ? <>Se eliminarán <strong>{limpiezaInfo.total}</strong> cita(s).</>
              : 'No hay citas antiguas para eliminar en ese período.')}
        </p>
        {limpiezaInfo?.total > 0 && (
          <div className="form-group">
            <label className="form-label">Para confirmar, escribe: <strong>{limpiezaInfo.textoConfirmacion}</strong></label>
            <input className="form-control" value={limpiezaConfirm} onChange={e => setLimpiezaConfirm(e.target.value)} placeholder={limpiezaInfo.textoConfirmacion} />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmEliminar}
        onClose={() => setConfirmEliminar(null)}
        onConfirm={handleEliminarCancelada}
        title={confirmEliminar?.EstadoCita === 'Diagnosticada' ? 'Eliminar diagnóstico' : 'Eliminar cita cancelada'}
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

