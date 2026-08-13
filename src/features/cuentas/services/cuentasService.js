import api from '../../../shared/services/api.js';
const BASE = '/api/usuarios';

export const cuentasService = {
  getAll:          ()                          => api.get(BASE).then(r => r.data),
  cambiarRol:      (tipo, id, Id_Rol)           => api.patch(`${BASE}/${tipo}/${id}/rol`, { Id_Rol }).then(r => r.data),
  cambiarEstado:   (tipo, id, Estado)           => api.patch(`${BASE}/${tipo}/${id}/estado`, { Estado }).then(r => r.data),
};
