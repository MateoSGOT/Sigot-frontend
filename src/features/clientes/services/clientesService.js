import api from '../../../shared/services/api.js';
const BASE = '/api/clientes';
export const clientesService = {
  getAll: () => api.get(BASE).then(r => r.data),
  getById: (id) => api.get(`${BASE}/${id}`).then(r => r.data),
  create: (data) => api.post(BASE, data).then(r => r.data),
  update: (id, data) => api.put(`${BASE}/${id}`, data).then(r => r.data),
  toggleEstado: (id, Estado) => api.patch(`${BASE}/${id}/estado`, { Estado }).then(r => r.data),
  // Borrado real (super admin): vista previa de dependencias + eliminación forzada.
  getDependencias: (id) => api.get(`${BASE}/${id}/dependencias`).then(r => r.data?.data),
  eliminar: (id, confirmacion) => api.delete(`${BASE}/${id}`, { data: { confirmacion } }).then(r => r.data),
  // Conversión Cliente→Empleado (super admin): borra el cliente en cascada y crea el empleado.
  convertirAEmpleado: (id, data) => api.post(`${BASE}/${id}/convertir-a-empleado`, data).then(r => r.data),
};
