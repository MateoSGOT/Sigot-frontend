import api from '../../../shared/services/api.js';
const BASE = '/api/agenda';
export const agendaService = {
  getAll: () => api.get(BASE).then(r => r.data),
  getById: (id) => api.get(`${BASE}/${id}`).then(r => r.data),
  create: (data) => api.post(BASE, data).then(r => r.data),
  update: (id, data) => api.put(`${BASE}/${id}`, data).then(r => r.data),
  toggleEstado: (id, Estado) => api.patch(`${BASE}/${id}/estado`, { Estado }).then(r => r.data),
  cancelar: (id, motivo) => api.patch(`${BASE}/${id}/cancelar`, { Motivo: motivo }).then(r => r.data),
  generarOrden: (id, data) => api.post(`${BASE}/${id}/orden`, data).then(r => r.data),
  remove: (id) => api.delete(`${BASE}/${id}`).then(r => r.data),
  // Borrado real de una cita (superadmin), endpoint separado del remove operativo.
  getDependencias: (id) => api.get(`${BASE}/${id}/dependencias`).then(r => r.data?.data),
  eliminar: (id, confirmacion) => api.delete(`${BASE}/${id}/borrado-real`, { data: { confirmacion } }).then(r => r.data),
};
