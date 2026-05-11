import api from '../../../shared/services/api.js';
const BASE = '/api/roles';
export const rolesService = {
  getAll:       ()         => api.get(BASE).then(r => r.data),
  create:       (data)     => api.post(BASE, data).then(r => r.data),
  update:       (id, data) => api.put(`${BASE}/${id}`, data).then(r => r.data),
  toggleEstado: (id)       => api.patch(`${BASE}/${id}/estado`).then(r => r.data),
};
