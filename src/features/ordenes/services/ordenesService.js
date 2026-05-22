import api from '../../../shared/services/api.js';
const BASE = '/api/ordenes';
export const ordenesService = {
  getAll:         ()             => api.get(BASE).then(r => r.data),
  getById:        (id)           => api.get(`${BASE}/${id}`).then(r => r.data),
  update:         (id, data)     => api.put(`${BASE}/${id}`, data).then(r => r.data),
  toggleEstado:   (id, Estado)   => api.patch(`${BASE}/${id}/estado`, { Estado }).then(r => r.data),
  addServicio:    (id, data)     => api.post(`${BASE}/${id}/servicios`, data).then(r => r.data),
  addRepuesto:    (id, data)     => api.post(`${BASE}/${id}/repuestos`, data).then(r => r.data),
  setManoDeObra:  (id, valor)    => api.patch(`${BASE}/${id}/mano-de-obra`, { mano_de_obra: valor }).then(r => r.data),
  deleteServicio: (id, sId)      => api.delete(`${BASE}/${id}/servicios/${sId}`).then(r => r.data),
  deleteRepuesto: (id, rId)      => api.delete(`${BASE}/${id}/repuestos/${rId}`).then(r => r.data),
};
