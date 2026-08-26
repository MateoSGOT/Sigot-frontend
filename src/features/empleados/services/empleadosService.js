import api from '../../../shared/services/api.js';
const BASE = '/api/empleados';
export const empleadosService = {
  getAll: () => api.get(BASE).then(r => r.data),
  getById: (id) => api.get(`${BASE}/${id}`).then(r => r.data),
  create: (data) => api.post(BASE, data).then(r => r.data),
  update: (id, data) => api.put(`${BASE}/${id}`, data).then(r => r.data),
  toggleEstado: (id, Estado) => api.patch(`${BASE}/${id}/estado`, { Estado }).then(r => r.data),
  remove: (id) => api.delete(`${BASE}/${id}`).then(r => r.data),
  // Borrado real bloqueo-duro (superadmin), endpoint separado del remove operativo.
  getDependencias: (id) => api.get(`${BASE}/${id}/dependencias`).then(r => r.data?.data),
  eliminar: (id, confirmacion) => api.delete(`${BASE}/${id}/borrado-real`, { data: { confirmacion } }).then(r => r.data),
  // Reasignar agendas/órdenes a otro empleado y luego eliminar.
  reasignarYEliminar: (id, Id_EmpleadoDestino, confirmacion) =>
    api.post(`${BASE}/${id}/reasignar-y-eliminar`, { Id_EmpleadoDestino, confirmacion }).then(r => r.data),
  // Conversión Empleado→Cliente (super admin): bloquea si tiene Órdenes/Novedades.
  convertirACliente: (id, data) => api.post(`${BASE}/${id}/convertir-a-cliente`, data).then(r => r.data),
};
