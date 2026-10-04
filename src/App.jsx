import React, { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { restoreSession, fetchUserPermisos } from './features/auth/slices/authSlice.js';
import Layout from './shared/components/Layout/Layout.jsx';
import LandingPage from './features/landing/pages/LandingPage.jsx';
import LoginPage from './features/auth/pages/LoginPage.jsx';
import RegistroPage from './features/auth/pages/RegistroPage.jsx';
import ResetPasswordPage from './features/auth/pages/ResetPasswordPage.jsx';
import CambiarPasswordInicialPage from './features/auth/pages/CambiarPasswordInicialPage.jsx';

// Panel del taller y portal del cliente: se cargan solo cuando alguien realmente entra ahí
// (lazy), para que un visitante anónimo de la landing pública no descargue las ~17 páginas
// del panel de administración junto con el bundle inicial.
const PortalPage = lazy(() => import('./features/portal/pages/PortalPage.jsx'));
// Agendamiento publico con autoregistro en caliente: entra gente sin sesion desde la
// landing, asi que va lazy igual que el portal (no lo descarga quien solo mira la landing).
const AgendarCitaPage = lazy(() => import('./features/portal/pages/AgendarCitaPage.jsx'));
const DashboardPage = lazy(() => import('./features/dashboard/pages/DashboardPage.jsx'));
const ClientesPage = lazy(() => import('./features/clientes/pages/ClientesPage.jsx'));
const VehiculosPage = lazy(() => import('./features/vehiculos/pages/VehiculosPage.jsx'));
const EmpleadosPage = lazy(() => import('./features/empleados/pages/EmpleadosPage.jsx'));
const RepuestosPage = lazy(() => import('./features/repuestos/pages/RepuestosPage.jsx'));
const CategoriasPage = lazy(() => import('./features/categorias/pages/CategoriasPage.jsx'));
const ProveedoresPage = lazy(() => import('./features/proveedores/pages/ProveedoresPage.jsx'));
const ComprasPage = lazy(() => import('./features/compras/pages/ComprasPage.jsx'));
const ServiciosPage = lazy(() => import('./features/servicios/pages/ServiciosPage.jsx'));
const AgendaPage = lazy(() => import('./features/agenda/pages/AgendaPage.jsx'));
const OrdenesPage = lazy(() => import('./features/ordenes/pages/OrdenesPage.jsx'));
const NovedadesPage = lazy(() => import('./features/novedades/pages/NovedadesPage.jsx'));
const RolesPage = lazy(() => import('./features/roles/pages/RolesPage.jsx'));
const CuentasPage = lazy(() => import('./features/cuentas/pages/CuentasPage.jsx'));

/* ═══════════════════════════════════════════════════════════════════════════
   OMITIR LA VALIDACIÓN DE SESIÓN — SOLO DESARROLLO LOCAL

   Sirve para revisar el maquetado de una vista sin tener credenciales del tipo
   de cuenta que esa vista exige (p. ej. /portal, que rechaza a los empleados).

   Doble condición, y las dos hacen falta:

   · `import.meta.env.DEV` lo sustituye Vite por el literal `false` al compilar,
     así que la rama se elimina del bundle de producción por dead-code
     elimination. No es que "no se active" en producción: no llega a existir en
     el archivo servido.
   · `VITE_DEV_SKIP_AUTH` tiene que valer exactamente 'true', y vive en
     .env.local, que está en .gitignore. Un dev que clone el repo no lo tiene.

   NO inyecta token ni usuario falso, a propósito. Con la sesión vacía los
   fetches de cada página reciben 401 y las vistas quedan en su estado vacío,
   que es justo lo que se quiere mirar. Y no hay bucle de redirección: el
   interceptor de shared/services/api.js solo manda a /login si HABÍA un token
   en localStorage (ver `hadToken`), y acá no hay ninguno.

   Esto NO relaja nada en el servidor: cada endpoint sigue exigiendo su JWT y su
   permiso (authenticate / checkPermiso). Sin sesión real no se pueden leer ni
   escribir datos; solo se ve la cáscara.
   ═══════════════════════════════════════════════════════════════════════════ */
const OMITIR_AUTH_DEV = import.meta.env.DEV
  && import.meta.env.VITE_DEV_SKIP_AUTH === 'true';

/* Aviso imposible de no ver. Un bypass de autenticación silencioso es peligroso
   incluso en local: se olvida encendido y se confunde "se ve vacío" con un bug
   de la vista. */
function AvisoAuthOmitida() {
  if (!OMITIR_AUTH_DEV) return null;
  return (
    <div
      role="status"
      style={{
        /* Pastilla a la derecha y POR ENCIMA de la barra inferior (64px + zona
           segura), no una franja a bottom:0 a lo ancho: con z-index maximo
           tapaba la navegacion movil entera. Verificado en el navegador: la
           barra quedaba oculta detras del aviso. En escritorio no hay barra,
           asi que simplemente flota a 72px del borde. */
        position: 'fixed',
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
        right: '8px', maxWidth: 'calc(100vw - 16px)', zIndex: 2147483647,
        borderRadius: 'var(--radius-full)',
        background: 'var(--color-danger)', color: 'var(--color-danger-on)',
        // Propiedades separadas y no el shorthand `font`: el shorthand con un
        // var() para la familia es frágil y además resetea lo que no se nombre.
        fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600,
        lineHeight: 1.4, letterSpacing: '0.04em',
        textAlign: 'center', padding: '6px 12px', pointerEvents: 'none',
      }}
    >
      VITE_DEV_SKIP_AUTH=true · sesión omitida · solo revisión de maquetado · sin datos reales
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { token, restoring, debeCambiarPassword } = useSelector((state) => state.auth);
  if (OMITIR_AUTH_DEV) return children;
  if (restoring) return null;
  if (!token) return <Navigate to="/login" replace />;
  // Bloqueo real: mientras deba cambiar la contraseña, no accede a ninguna ruta del panel.
  if (debeCambiarPassword) return <Navigate to="/cambiar-password" replace />;
  return children;
}

// Gestión de cuentas (Fase 3): exclusiva del Super Administrador. El backend también lo
// exige (requireSuperAdmin); esto solo evita que alguien más ni siquiera vea la página.
function RequireSuperAdmin({ children }) {
  const { token, restoring, debeCambiarPassword, empleado, cliente } = useSelector((state) => state.auth);
  if (OMITIR_AUTH_DEV) return children;
  if (restoring) return null;
  if (!token) return <Navigate to="/login" replace />;
  if (debeCambiarPassword) return <Navigate to="/cambiar-password" replace />;
  if (!empleado?.EsSuperAdmin && !cliente?.EsSuperAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function PortalRoute({ children }) {
  const { token, tipo, restoring, debeCambiarPassword } = useSelector((state) => state.auth);
  if (OMITIR_AUTH_DEV) return children;
  if (restoring) return null;
  if (!token) return <Navigate to="/login" replace />;
  if (debeCambiarPassword) return <Navigate to="/cambiar-password" replace />;
  if (tipo === 'empleado') return <Navigate to="/dashboard" replace />;
  return children;
}

// Ruta del cambio obligatorio: solo accesible autenticado y con la bandera activa.
function RequirePasswordChange({ children }) {
  const { token, restoring, debeCambiarPassword } = useSelector((state) => state.auth);
  // Mismo bypass de desarrollo que los otros tres guardianes: sin el, esta vista
  // solo es alcanzable con un usuario real que tenga debeCambiarPassword en true,
  // asi que no habia forma de revisarla en pantalla. Se elimina en el build de
  // produccion (import.meta.env.DEV queda en false y el bloque se poda).
  if (OMITIR_AUTH_DEV) return children;
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

  // Fetch permission names whenever the logged-in role changes (login or session restore).
  // Incluye cliente.Id_Rol: un cliente promovido a un rol administrativo (Fase 3) también
  // necesita sus permisos reales para el panel de staff, no solo los empleados.
  useEffect(() => {
    const idRolActivo = empleado?.Id_Rol ?? cliente?.Id_Rol;
    if (token && idRolActivo) {
      dispatch(fetchUserPermisos(idRolActivo));
    }
  }, [empleado?.Id_Rol, cliente?.Id_Rol]); // eslint-disable-line react-hooks/exhaustive-deps

  if (restoring) return null;

  const loginRedirect = debeCambiarPassword ? '/cambiar-password' : (tipo === 'cliente' ? '/portal' : '/dashboard');

  return (
    <>
    {/* Franja fija cuando VITE_DEV_SKIP_AUTH esta activo. Sin aviso, un bypass
        encendido se olvida y "la vista sale vacia" parece un bug de la vista. */}
    <AvisoAuthOmitida />
    <Suspense fallback={null}>
    <Routes>
      {/* Public routes */}
      <Route path="/" element={token && debeCambiarPassword ? <Navigate to="/cambiar-password" replace /> : <LandingPage />} />
      <Route path="/portal" element={<PortalRoute><PortalPage /></PortalRoute>} />
      {/* Agendamiento publico: SIN guard a proposito -- es el punto de entrada para
          clientes nuevos. La propia pagina detecta si hay sesion y arma el flujo
          (con sesion omite cuenta/codigo; sin sesion registra todo en caliente). */}
      <Route path="/agendar" element={<AgendarCitaPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/cambiar-password" element={<RequirePasswordChange><CambiarPasswordInicialPage /></RequirePasswordChange>} />
      <Route
        path="/login"
        element={token ? <Navigate to={loginRedirect} replace /> : <LoginPage />}
      />
      {/* Autoregistro de clientes (self-service). Con sesión abierta no tiene sentido:
          redirige igual que /login. */}
      <Route
        path="/registro"
        element={token ? <Navigate to={loginRedirect} replace /> : <RegistroPage />}
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
        <Route path="/cuentas"     element={<RequireSuperAdmin><CuentasPage /></RequireSuperAdmin>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </>
  );
}

export default App;
