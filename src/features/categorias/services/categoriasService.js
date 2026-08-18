import api from '../../../shared/services/api.js';
const BASE = '/api/categoria-repuestos';
export const categoriasService = {
  getAll: () => api.get(BASE).then(r => r.data),
  create: (data) => api.post(BASE, data).then(r => r.data),
  update: (id, data) => api.put(`${BASE}/${id}`, data).then(r => r.data),
  toggleEstado: (id, Estado) => api.patch(`${BASE}/${id}/estado`, { Estado }).then(r => r.data),
  // Borrado real (super admin): vista previa de dependencias + eliminación forzada.
  getDependencias: (id) => api.get(`${BASE}/${id}/dependencias`).then(r => r.data?.data),
  eliminar: (id, confirmacion) => api.delete(`${BASE}/${id}`, { data: { confirmacion } }).then(r => r.data),
};
