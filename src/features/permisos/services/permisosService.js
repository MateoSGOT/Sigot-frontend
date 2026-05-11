import api from '../../../shared/services/api.js';
const BASE = '/api/permisos';
export const permisosService = {
  getAll:       ()         => api.get(BASE).then(r => r.data),
  create:       (data)     => api.post(BASE, data).then(r => r.data),
  update:       (id, data) => api.put(`${BASE}/${id}`, data).then(r => r.data),
  toggleEstado: (id)       => api.patch(`${BASE}/${id}/estado`).then(r => r.data),
  getByRol:     (id_rol)   => api.get(`${BASE}/rol/${id_rol}`).then(r => r.data),
  saveByRol:    (id_rol, data) => api.put(`${BASE}/rol/${id_rol}`, data).then(r => r.data),
};
