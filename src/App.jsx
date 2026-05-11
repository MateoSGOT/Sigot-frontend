import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { restoreSession } from './features/auth/slices/authSlice.js';
import Layout from './shared/components/Layout/Layout.jsx';
import LandingPage from './features/landing/pages/LandingPage.jsx';
import LoginPage from './features/auth/pages/LoginPage.jsx';
import PortalPage from './features/portal/pages/PortalPage.jsx';
import DashboardPage from './features/dashboard/pages/DashboardPage.jsx';
import ClientesPage from './features/clientes/pages/ClientesPage.jsx';
import VehiculosPage from './features/vehiculos/pages/VehiculosPage.jsx';
import EmpleadosPage from './features/empleados/pages/EmpleadosPage.jsx';
import RepuestosPage from './features/repuestos/pages/RepuestosPage.jsx';
import CategoriasPage from './features/categorias/pages/CategoriasPage.jsx';
import ProveedoresPage from './features/proveedores/pages/ProveedoresPage.jsx';
import ComprasPage from './features/compras/pages/ComprasPage.jsx';
import ServiciosPage from './features/servicios/pages/ServiciosPage.jsx';
import AgendaPage from './features/agenda/pages/AgendaPage.jsx';
import OrdenesPage from './features/ordenes/pages/OrdenesPage.jsx';
import NovedadesPage from './features/novedades/pages/NovedadesPage.jsx';
import RolesPage from './features/roles/pages/RolesPage.jsx';
import PermisosPage from './features/permisos/pages/PermisosPage.jsx';

function ProtectedRoute({ children }) {
  const { token, restoring } = useSelector((state) => state.auth);
  if (restoring) return null;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  const dispatch = useDispatch();
  const { token, empleado, restoring } = useSelector((state) => state.auth);

  useEffect(() => {
    if (token && !empleado) {
      dispatch(restoreSession());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (restoring) return null;

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/portal" element={<PortalPage />} />
      <Route
        path="/login"
        element={token ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />

      {/* Protected admin/employee routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
      </Route>

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard"   element={<DashboardPage />} />
        <Route path="clientes"    element={<ClientesPage />} />
        <Route path="vehiculos"   element={<VehiculosPage />} />
        <Route path="empleados"   element={<EmpleadosPage />} />
        <Route path="repuestos"   element={<RepuestosPage />} />
        <Route path="categorias"  element={<CategoriasPage />} />
        <Route path="proveedores" element={<ProveedoresPage />} />
        <Route path="compras"     element={<ComprasPage />} />
        <Route path="servicios"   element={<ServiciosPage />} />
        <Route path="agenda"      element={<AgendaPage />} />
        <Route path="ordenes"     element={<OrdenesPage />} />
        <Route path="novedades"   element={<NovedadesPage />} />
        <Route path="roles"       element={<RolesPage />} />
        <Route path="permisos"    element={<PermisosPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
