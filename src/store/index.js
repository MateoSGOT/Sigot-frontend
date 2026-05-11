import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/slices/authSlice';
import clientesReducer from '../features/clientes/slices/clientesSlice';
import vehiculosReducer from '../features/vehiculos/slices/vehiculosSlice';
import empleadosReducer from '../features/empleados/slices/empleadosSlice';
import repuestosReducer from '../features/repuestos/slices/repuestosSlice';
import categoriasReducer from '../features/categorias/slices/categoriasSlice';
import proveedoresReducer from '../features/proveedores/slices/proveedoresSlice';
import comprasReducer from '../features/compras/slices/comprasSlice';
import serviciosReducer from '../features/servicios/slices/serviciosSlice';
import agendaReducer from '../features/agenda/slices/agendaSlice';
import ordenesReducer from '../features/ordenes/slices/ordenesSlice';
import novedadesReducer from '../features/novedades/slices/novedadesSlice';
import rolesReducer from '../features/roles/slices/rolesSlice';
import permisosReducer from '../features/permisos/slices/permisosSlice';
import dashboardReducer from '../features/dashboard/slices/dashboardSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    clientes: clientesReducer,
    vehiculos: vehiculosReducer,
    empleados: empleadosReducer,
    repuestos: repuestosReducer,
    categorias: categoriasReducer,
    proveedores: proveedoresReducer,
    compras: comprasReducer,
    servicios: serviciosReducer,
    agenda: agendaReducer,
    ordenes: ordenesReducer,
    novedades: novedadesReducer,
    roles: rolesReducer,
    permisos: permisosReducer,
    dashboard: dashboardReducer,
  },
});

export default store;
