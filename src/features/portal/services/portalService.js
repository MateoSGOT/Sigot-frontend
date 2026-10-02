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

  async crearCita({ Id_Vehiculo, Fecha, Hora, Descripcion, TipoCita }) {
    const r = await api.post('/api/portal/citas', {
      Id_Vehiculo: Number(Id_Vehiculo),
      Fecha,
      Hora,
      ...(Descripcion ? { Descripcion } : {}),
      ...(TipoCita ? { TipoCita } : {}),
    });
    return r.data?.data ?? r.data;
  },
};
