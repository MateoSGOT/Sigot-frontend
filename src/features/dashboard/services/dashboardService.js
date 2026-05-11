import api from '../../../shared/services/api.js';

export const dashboardService = {
  getRepuestos: () => api.get('/api/dashboard/repuestos').then(r => r.data),
  getCompras: () => api.get('/api/dashboard/compras').then(r => r.data),
  getServicios: () => api.get('/api/dashboard/servicios').then(r => r.data),
  getEmpleados: () => api.get('/api/dashboard/empleados').then(r => r.data),
};
