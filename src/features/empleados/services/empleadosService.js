import api from '../../../shared/services/api.js';
const BASE = '/api/empleados';
export const empleadosService = {
  getAll: () => api.get(BASE).then(r => r.data),
  getById: (id) => api.get(`${BASE}/${id}`).then(r => r.data),
  create: (data) => api.post(BASE, data).then(r => r.data),
  update: (id, data) => api.put(`${BASE}/${id}`, data).then(r => r.data),
  toggleEstado: (id, Estado) => api.patch(`${BASE}/${id}/estado`, { Estado }).then(r => r.data),
};
