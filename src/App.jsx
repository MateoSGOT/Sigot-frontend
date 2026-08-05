import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { restoreSession, fetchUserPermisos } from './features/auth/slices/authSlice.js';
import Layout from './shared/components/Layout/Layout.jsx';
import LandingPage from './features/landing/pages/LandingPage.jsx';
import LoginPage from './features/auth/pages/LoginPage.jsx';
import ResetPasswordPage from './features/auth/pages/ResetPasswordPage.jsx';
import CambiarPasswordInicialPage from './features/auth/pages/CambiarPasswordInicialPage.jsx';
import PortalPage from './features/portal/pages/PortalPage.jsx';
import DashboardPage from './features/dashboard/pages/DashboardPage.jsx';
import ClientesPage from './features/clientes/pages/ClientesPage.jsx';
import VehiculosPage from './features/vehiculos/pages/VehiculosPage.jsx';
import MarcasPage from './features/marcas/pages/MarcasPage.jsx';
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

function ProtectedRoute({ children }) {
  const { token, restoring, debeCambiarPassword } = useSelector((state) => state.auth);
  if (restoring) return null;
  if (!token) return <Navigate to="/login" replace />;
  // Bloqueo real: mientras deba cambiar la contraseña, no accede a ninguna ruta del panel.
  if (debeCambiarPassword) return <Navigate to="/cambiar-password" replace />;
  return children;
}

function PortalRoute({ children }) {
  const { token, tipo, restoring, debeCambiarPassword } = useSelector((state) => state.auth);
  if (restoring) return null;
  if (!token) return <Navigate to="/login" replace />;
  if (debeCambiarPassword) return <Navigate to="/cambiar-password" replace />;
  if (tipo === 'empleado') return <Navigate to="/dashboard" replace />;
  return children;
}

// Ruta del cambio obligatorio: solo accesible autenticado y con la bandera activa.
function RequirePasswordChange({ children }) {
  const { token, restoring, debeCambiarPassword } = useSelector((state) => state.auth);
  if (restoring) return null;
  if (!token) return <Navigate to="/login" replace />;
  if (!debeCambiarPassword) return <Navigate to="/" replace />;
  return children;
}

function App() {
  const dispatch = useDispatch();
  const { token, empleado, cliente, tipo, restoring, debeCambiarPassword } = useSelector((state) => state.auth);

  useEffect(() => {
    if (token && !empleado && !cliente) {
      dispatch(restoreSession());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch permission names whenever the logged-in role changes (login or session restore)
  useEffect(() => {
    if (token && empleado?.Id_Rol) {
      dispatch(fetchUserPermisos(empleado.Id_Rol));
    }
  }, [empleado?.Id_Rol]); // eslint-disable-line react-hooks/exhaustive-deps

  if (restoring) return null;

  const loginRedirect = debeCambiarPassword ? '/cambiar-password' : (tipo === 'cliente' ? '/portal' : '/dashboard');

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={token && debeCambiarPassword ? <Navigate to="/cambiar-password" replace /> : <LandingPage />} />
      <Route path="/portal" element={<PortalRoute><PortalPage /></PortalRoute>} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/cambiar-password" element={<RequirePasswordChange><CambiarPasswordInicialPage /></RequirePasswordChange>} />
      <Route
        path="/login"
        element={token ? <Navigate to={loginRedirect} replace /> : <LoginPage />}
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

      {/* Rutas protegidas del panel: layout SIN path (pathless) con hijos de
          path absoluto. Así "/" queda exclusivamente para la landing pública
          y cerrar sesión (navigate('/')) no cae en el ProtectedRoute. */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard"   element={<DashboardPage />} />
        <Route path="/clientes"    element={<ClientesPage />} />
        <Route path="/vehiculos"   element={<VehiculosPage />} />
        <Route path="/marcas"      element={<MarcasPage />} />
        <Route path="/empleados"   element={<EmpleadosPage />} />
        <Route path="/repuestos"   element={<RepuestosPage />} />
        <Route path="/categorias"  element={<CategoriasPage />} />
        <Route path="/proveedores" element={<ProveedoresPage />} />
        <Route path="/compras"     element={<ComprasPage />} />
        <Route path="/servicios"   element={<ServiciosPage />} />
        <Route path="/agenda"      element={<AgendaPage />} />
        <Route path="/ordenes"     element={<OrdenesPage />} />
        <Route path="/novedades"   element={<NovedadesPage />} />
        <Route path="/roles"       element={<RolesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
