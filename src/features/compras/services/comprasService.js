import api from '../../../shared/services/api.js';
const BASE = '/api/compras';
export const comprasService = {
  getAll: () => api.get(BASE).then(r => r.data),
  getById: (id) => api.get(`${BASE}/${id}`).then(r => r.data),
  create: (data) => api.post(BASE, data).then(r => r.data),
  anular: (id) => api.patch(`${BASE}/${id}/anular`).then(r => r.data),
};
