import api from '../../../shared/services/api.js';

const qs = ({ desde, hasta, agrupacion, limit }) => {
  const p = new URLSearchParams();
  if (desde) p.set('desde', desde);
  if (hasta) p.set('hasta', hasta);
  if (agrupacion) p.set('agrupacion', agrupacion);
  if (limit) p.set('limit', limit);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const dashboardService = {
  getRepuestos:  () => api.get('/api/dashboard/repuestos').then(r => r.data),
  // Reportes por rango (Tanda B)
  getResumen:       (r) => api.get(`/api/dashboard/resumen${qs(r)}`).then(x => x.data),
  getIngresos:      (r) => api.get(`/api/dashboard/ingresos${qs(r)}`).then(x => x.data),
  getTopServicios:  (r) => api.get(`/api/dashboard/top-servicios${qs(r)}`).then(x => x.data),
  getTopRepuestos:  (r) => api.get(`/api/dashboard/top-repuestos${qs(r)}`).then(x => x.data),
  getProductividad: (r) => api.get(`/api/dashboard/productividad${qs(r)}`).then(x => x.data),
};
