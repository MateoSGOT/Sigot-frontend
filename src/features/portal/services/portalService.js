import api from '../../../shared/services/api.js';

// Llamadas del portal del cliente. El interceptor de api.js ya adjunta el token guardado,
// así que no hace falta pasar headers a mano (PortalPage sí lo hace por su cuenta, de antes).
export const portalService = {
  async getVehiculos() {
    const r = await api.get('/api/portal/vehiculos');
    return Array.isArray(r.data?.data) ? r.data.data : [];
  },

  // Alta de vehículo por el propio cliente. El Id_Cliente lo pone el backend desde el
  // token -- mandarlo en el body hace que la API responda 400 a propósito
  // (ver portal.controller.js::crearVehiculo).
  async crearVehiculo({ Placa, Anio, Color, Kilometraje }) {
    const r = await api.post('/api/portal/vehiculos', {
      Placa,
      Anio: Number(Anio),
      ...(Color ? { Color } : {}),
      ...(Kilometraje !== '' && Kilometraje != null ? { Kilometraje: Number(Kilometraje) } : {}),
    });
    return r.data?.data ?? r.data;
  },

  // Horario real de atencion del taller. Requiere sesion, asi que solo sirve para un
  // cliente ya logueado; el flujo anonimo cae a los valores por defecto.
  async getHorario() {
    const r = await api.get('/api/agenda/horario');
    return r.data?.data ?? r.data ?? null;
  },

  // Tecnicos que atienden esa fecha (con su bandera `disponible`).
  async getEmpleadosDisponibles(fecha) {
    const r = await api.get(`/api/portal/empleados-disponibles?fecha=${fecha}`);
    return Array.isArray(r.data?.data) ? r.data.data : [];
  },

  // Franjas ya tomadas del tecnico elegido esa fecha (citas + novedades puntuales).
  async getHorasOcupadas(fecha, idEmpleado) {
    const r = await api.get(`/api/portal/horas-ocupadas?id_empleado=${idEmpleado}&fecha=${fecha}`);
    return Array.isArray(r.data?.data) ? r.data.data : [];
  },

  async crearCita({ Id_Vehiculo, Fecha, Hora, Descripcion, TipoCita, Id_Empleado }) {
    const r = await api.post('/api/portal/citas', {
      Id_Vehiculo: Number(Id_Vehiculo),
      Fecha,
      Hora,
      ...(Descripcion ? { Descripcion } : {}),
      ...(TipoCita ? { TipoCita } : {}),
      ...(Id_Empleado ? { Id_Empleado: Number(Id_Empleado) } : {}),
    });
    return r.data?.data ?? r.data;
  },
};
