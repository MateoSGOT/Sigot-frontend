import api from '../../../shared/services/api.js';

const BASE = '/api/marcas';

export const marcasService = {
  getAll:       () => api.get(BASE).then(r => r.data),
  getById:      (id) => api.get(`${BASE}/${id}`).then(r => r.data),
  create:       (data) => api.post(BASE, data).then(r => r.data),
  update:       (id, data) => api.put(`${BASE}/${id}`, data).then(r => r.data),
  toggleEstado: (id, Estado) => api.patch(`${BASE}/${id}/estado`, { Estado }).then(r => r.data),

  // Modelos
  getModelos:         (idMarca) => api.get(`${BASE}/${idMarca}/modelos`).then(r => r.data),
  createModelo:       (idMarca, data) => api.post(`${BASE}/${idMarca}/modelos`, data).then(r => r.data),
  updateModelo:       (id, data) => api.put(`/api/modelos/${id}`, data).then(r => r.data),
  toggleModeloEstado: (id, Estado) => api.patch(`/api/modelos/${id}/estado`, { Estado }).then(r => r.data),
};
