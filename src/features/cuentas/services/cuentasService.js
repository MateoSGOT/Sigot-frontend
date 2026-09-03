import api from '../../../shared/services/api.js';
import { empleadosService } from '../../empleados/services/empleadosService.js';
import { clientesService } from '../../clientes/services/clientesService.js';
const BASE = '/api/usuarios';

// Borrado real de una cuenta: delega al service del tipo de origen (empleado/cliente),
// que ya implementa el mismo flujo de vista previa + confirmación por texto exacto que
// el resto de borrados protegidos del sistema.
const servicioPorTipo = (tipo) => (tipo === 'empleado' ? empleadosService : clientesService);

export const cuentasService = {
  getAll:          ()                          => api.get(BASE).then(r => r.data),
  cambiarRol:      (tipo, id, Id_Rol)           => api.patch(`${BASE}/${tipo}/${id}/rol`, { Id_Rol }).then(r => r.data),
  getDependencias: (tipo, id)                   => servicioPorTipo(tipo).getDependencias(id),
  eliminar:        (tipo, id, confirmacion)     => servicioPorTipo(tipo).eliminar(id, confirmacion),
  // Limpieza masiva de cuentas inactivas creadas antes de una fecha (superadmin).
  limpiezaPreview: (antesDe)                    => api.get(`${BASE}/limpieza`, { params: { antesDe } }).then(r => r.data),
  limpiezaEjecutar: (antesDe, confirmacion)     => api.post(`${BASE}/limpieza`, { antesDe, confirmacion }).then(r => r.data),
};
