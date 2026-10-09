/* ═══════════════════════════════════════════════════════════════════════════
   Estructura de navegación y filtrado por permisos — FUENTE ÚNICA.

   Lo consumen el Sidebar (escritorio/drawer) y BottomNav (barra inferior móvil).
   Vive acá y no dentro de Sidebar.jsx por una razón concreta: `canSee` decide
   qué módulos ve cada rol. Si la barra inferior reimplementara esa función,
   tendríamos dos criterios de visibilidad que se desincronizan en silencio, y el
   que se quede atrás puede terminar mostrando un módulo que el rol no debería
   ver. Un solo lugar, un solo criterio.

   Esto NO es control de acceso: el backend valida cada petición con checkPermiso.
   Acá solo se decide qué se dibuja.
   ═══════════════════════════════════════════════════════════════════════════ */
import {
  MdDashboard, MdPeople, MdDirectionsCar, MdBuild, MdShoppingCart,
  MdMiscellaneousServices, MdAssignment, MdEventNote,
  MdNewReleases, MdSecurity, MdCategory, MdLocalShipping,
  MdPerson, MdSettings, MdStorage, MdAdminPanelSettings,
} from 'react-icons/md';

export const NAV_STRUCTURE = [
  { type: 'section', label: 'Menú principal' },
  { type: 'link', to: '/dashboard', icon: MdDashboard, label: 'Dashboard', permiso: 'DASHBOARD' },
  // Configuración: todo lo administrativo (usuarios del sistema y su acceso), justo
  // después del Dashboard, separado del flujo operativo del taller de abajo. Es un
  // desplegable como Vehículos/Inventario -- no una sección estática.
  {
    type: 'group', name: 'Configuración', icon: MdSettings,
    children: [
      { to: '/empleados', icon: MdPeople,   label: 'Empleados', permiso: 'EMPLEADOS' },
      { to: '/clientes',  icon: MdPerson,   label: 'Clientes',  permiso: 'CLIENTES'  },
      { to: '/roles',     icon: MdSecurity, label: 'Roles',     permiso: 'ROLES'     },
    ],
  },
  { type: 'section', label: 'Operación' },
  {
    type: 'group', name: 'Vehículos', icon: MdDirectionsCar,
    children: [
      { to: '/vehiculos', icon: MdDirectionsCar,     label: 'Vehículos',        permiso: 'VEHICULOS' },
    ],
  },
  { type: 'link', to: '/agenda',    icon: MdEventNote,             label: 'Agenda',    permiso: 'AGENDA'    },
  { type: 'link', to: '/servicios', icon: MdMiscellaneousServices, label: 'Servicios', permiso: 'SERVICIOS' },
  {
    type: 'group', name: 'Inventario', icon: MdStorage,
    children: [
      { to: '/repuestos',  icon: MdBuild,    label: 'Repuestos',  permiso: 'REPUESTOS'  },
    ],
  },
  { type: 'link', to: '/ordenes',    icon: MdAssignment,   label: 'Orden de Trabajo', permiso: 'ORDENES'     },
  { type: 'link', to: '/proveedores', icon: MdLocalShipping, label: 'Proveedores',    permiso: 'PROVEEDORES' },
  { type: 'link', to: '/compras',    icon: MdShoppingCart,  label: 'Compras',         permiso: 'COMPRAS'     },
  { type: 'link', to: '/novedades',  icon: MdNewReleases,   label: 'Novedades',       permiso: 'NOVEDADES'   },
];

/* "Cuentas y accesos": exclusiva del Super Administrador, no depende del sistema
   genérico de permisos por módulo -- se inyecta DENTRO de "Configuración" (no como
   enlace suelto) solo cuando el usuario logueado es super admin, así un rol normal
   con acceso a Empleados/Clientes/Roles nunca la ve en el grupo. */
export function navConCuentas(esSuperAdmin) {
  return NAV_STRUCTURE.map((item) => (
    item.type === 'group' && item.name === 'Configuración' && esSuperAdmin
      ? { ...item, children: [...item.children, { to: '/cuentas', icon: MdAdminPanelSettings, label: 'Cuentas y accesos', permiso: null }] }
      : item
  ));
}

export function buildVisibleNav(nav, permisos, esSuperAdmin) {
  // permisos === null → todavía cargando → mostrar todo sin flash. El super admin ve todo
  // sin importar lo que haya en Roles_x_Permisos: Dashboard en particular queda fuera de la
  // matriz de Roles a propósito (no sigue el patrón Ver/Crear/Editar/Eliminar), así que no
  // hay forma de asignárselo a un rol desde la UI -- sin este bypass, ni siquiera el super
  // admin vería el enlace a Dashboard en el menú.
  const canSee = (permiso) => {
    if (esSuperAdmin) return true;
    if (!permiso || permisos === null) return true;
    if (permiso === 'DASHBOARD') return permisos.some((p) => p.startsWith('DASHBOARD.'));
    return permisos.includes(`${permiso}.LISTAR`);
  };

  const filtered = nav.reduce((acc, item) => {
    if (item.type === 'section') { acc.push(item); return acc; }
    if (item.type === 'link') {
      if (canSee(item.permiso)) acc.push(item);
      return acc;
    }
    if (item.type === 'group') {
      const visible = item.children.filter((c) => canSee(c.permiso));
      if (visible.length > 0) acc.push({ ...item, children: visible });
      return acc;
    }
    return acc;
  }, []);

  // Eliminar section labels que no tienen ítems después
  return filtered.filter((item, i, arr) => {
    if (item.type !== 'section') return true;
    return arr.slice(i + 1).some((x) => x.type !== 'section');
  });
}

/* ── Barra inferior móvil ──
   Orden de prioridad por FRECUENCIA DE USO en el taller, no por el orden del
   menú: el mecánico entra a una orden de trabajo muchas más veces al día que a
   Proveedores. Se toman los primeros que el rol pueda ver, hasta `cupo`, y el
   resto queda en "Más" (que abre el drawer completo).

   Devuelve siempre enlaces planos -- la barra inferior no tiene submenús: un
   acordeón dentro de una barra de 64px de alto no se puede operar con el pulgar. */
const PRIORIDAD_MOVIL = ['/ordenes', '/agenda', '/vehiculos', '/repuestos', '/dashboard', '/clientes'];

export function linksParaBarraInferior(visibleNav, cupo = 4) {
  const planos = [];
  for (const item of visibleNav) {
    if (item.type === 'link') planos.push(item);
    else if (item.type === 'group') planos.push(...item.children);
  }

  const porRuta = new Map(planos.map((l) => [l.to, l]));
  const elegidos = [];

  for (const ruta of PRIORIDAD_MOVIL) {
    if (elegidos.length >= cupo) break;
    const link = porRuta.get(ruta);
    if (link) { elegidos.push(link); porRuta.delete(ruta); }
  }
  // Si el rol no ve ninguno de los prioritarios (p. ej. un rol solo de compras),
  // se completa con lo que sí tenga, en el orden del menú.
  for (const link of planos) {
    if (elegidos.length >= cupo) break;
    if (porRuta.has(link.to)) { elegidos.push(link); porRuta.delete(link.to); }
  }

  return elegidos;
}
