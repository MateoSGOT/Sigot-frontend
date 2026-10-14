import api from '../../../shared/services/api.js';

const BASE = '/api/notificaciones';

export const notificacionesService = {
  /* "mias" y no "todas": el backend resuelve el rol desde el token y devuelve
     solo los tipos a los que ese rol está suscrito. El filtro no se puede hacer
     aquí porque el frontend no debe decidir qué alertas le corresponden a cada
     rol -- esa es la matriz, y vive en la base. */
  getMias: ({ page = 1, pageSize = 30, soloNoLeidas = false, tipo = null } = {}) =>
    api.get(BASE + '/mias', { params: { page, pageSize, soloNoLeidas, ...(tipo ? { tipo } : {}) } }).then(r => r.data),

  marcarLeida: (id) => api.patch(`${BASE}/${id}/leida`).then(r => r.data),

  /* Marca el lote que ESE rol ve, no la tabla entera: lo decide el servidor con
     la misma consulta que arma el listado. */
  marcarTodasLeidas: () => api.patch(BASE + '/todas-leidas').then(r => r.data),

  // Matriz de suscripción (la consume RolesPage).
  getTiposDeRol: (idRol) => api.get(`${BASE}/rol/${idRol}`).then(r => r.data?.data),
  guardarTiposDeRol: (idRol, tipos) => api.put(`${BASE}/rol/${idRol}`, { tipos }).then(r => r.data?.data),
};
