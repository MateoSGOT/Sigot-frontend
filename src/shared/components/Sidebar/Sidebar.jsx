import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { MdLogout, MdChevronRight, MdMenuOpen } from 'react-icons/md';
import { logout } from '../../../features/auth/slices/authSlice';
import StockAlertBell from '../StockAlertBell/StockAlertBell.jsx';
import NovedadAlertBell from '../NovedadAlertBell/NovedadAlertBell.jsx';
import { useSidebar } from '../../contexts/SidebarContext.jsx';
// Estructura y filtrado por permisos: compartidos con BottomNav. Ver navStructure.js
// -- están afuera para que exista un solo criterio de visibilidad por rol.
import { navConCuentas, buildVisibleNav } from './navStructure.js';
import { motion as Motion } from 'motion/react';
import TooltipLateral from './TooltipLateral.jsx';
import { useMediaQuery, mq } from '../../styles/breakpoints.js';
import { RESORTE } from '../../styles/movimiento.js';
import './Sidebar.css';

/* ── Estado colapsado, en utilidades ───────────────────────────────────────
   El aspecto del sidebar sigue viniendo de Sidebar.css, que ya produce el panel
   flotante translucido sobre slate-50 descrito en el encargo. Lo que NO existia
   era el colapso: los tres tokens de ancho valian 232px, asi que el boton
   cambiaba la clase y el panel no se movia. Eso se arregla en variables.css
   (--sidebar-collapsed-width: 64px) y aqui va lo que el modo estrecho necesita
   en la marcacion.

   Estas utilidades ganan sin pelear con Sidebar.css porque esa hoja no declara
   las mismas propiedades: .sidebar__item-label no fija `display`, y el centrado
   se aplica sobre contenedores que solo traian gap y padding. Comprobado
   leyendo las reglas, no supuesto. */
const OCULTO_AL_COLAPSAR = 'hidden';
/* SOLO justify-center, y no es por economia. Probe con `gap-0 px-0` tambien y
   las dos son INERTES: Sidebar.css declara gap y padding en .sidebar__item, y
   esa hoja no esta estratificada, asi que le gana a la capa utilities.
   Comprobado en el navegador -- con las tres puestas, el computado seguia en
   gap 12px y padding 8px 12px.

   No hace falta forzarlas: con la etiqueta en display:none el icono queda como
   unico hijo flex, asi que el gap no separa nada, y el padding es simetrico, de
   modo que justify-center centra igual. Medido: desviacion de 0px entre el
   centro del item y el del icono.

   Dejarlas puestas habria sido peor que quitarlas: auditar-utilidades.mjs las
   da por buenas porque EXISTEN en el bundle -- lo que no puede comprobar es si
   ganan. */
const ITEM_COLAPSADO = 'justify-center';
const CABECERA_COLAPSADA = 'justify-center px-0';
const PERFIL_COLAPSADO = 'justify-center gap-0';

export default function Sidebar() {
  const dispatch  = useDispatch();
  const location  = useLocation();
  const { empleado, cliente, permisos } = useSelector((state) => state.auth);
  const { mobileOpen, collapsed, toggleCollapsed, setCollapsed } = useSidebar();
  /* El colapso es SOLO de escritorio: por debajo de 1024 el sidebar es un drawer
     que entra con transform y conserva su ancho. Sin esta condicion, el ancho en
     linea que pone Motion se aplicaria tambien en movil y encogeria el cajon. */
  const esEscritorio = useMediaQuery(mq.desktop);
  const estrecho = collapsed && esEscritorio;
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = React.useRef(null);
  const esSuperAdmin = !!(empleado?.EsSuperAdmin || cliente?.EsSuperAdmin);
  // La campana de novedades es exclusiva de Administrador/Super Administrador (avisa de
  // cosas como empleados desactivados con citas pendientes aún asignadas -- ver
  // NovedadAlertBell.jsx), no aplica a otros roles operativos ni a clientes.
  const esAdminOSuperAdmin = esSuperAdmin || empleado?.Rol === 'Administrador';

  React.useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const nav = navConCuentas(esSuperAdmin);
  const visibleNav = buildVisibleNav(nav, permisos, esSuperAdmin);

  const gruposDeLaRuta = (pathname) => {
    const groups = {};
    nav.forEach(item => {
      if (item.type === 'group') {
        groups[item.name] = item.children.some(c => pathname.startsWith(c.to));
      }
    });
    return groups;
  };

  const [openGroups, setOpenGroups] = useState(() => gruposDeLaRuta(location.pathname));

  // Al navegar a otra sección del menú, se cierra cualquier submenú que
  // hubiera quedado abierto (salvo el de la ruta a la que se entró).
  React.useEffect(() => {
    setOpenGroups(gruposDeLaRuta(location.pathname));
  }, [location.pathname]);

  // Acordeón: solo un grupo abierto a la vez (en cualquier sentido -- abrir uno
  // cierra el que estuviera abierto, sea el de arriba o el de abajo).
  const toggleGroup = (name) => {
    // Colapsado: al tocar un grupo, expandimos el sidebar y abrimos ese grupo
    // (si no, no habría dónde mostrar los hijos).
    if (collapsed) { setCollapsed(false); setOpenGroups({ [name]: true }); return; }
    setOpenGroups(p => (p[name] ? {} : { [name]: true }));
  };

  const handleLogout = () => {
    // Limpia sesión y hace una navegación DURA al login. Un window.location.replace
    // es determinista: recarga la página, aborta la petición de /logout en vuelo
    // (el interceptor 401 ni corre) y no depende del timing de React Router.
    dispatch(logout());
    window.location.replace('/login');
  };

  return (
    /* El ancho lo anima Motion y no CSS, y hay un motivo concreto: Sidebar.css
       lleva `transition: none` explicito porque transicionar `width` entre dos
       valores var() deja el ancho pegado en algunos motores (esta documentado
       ahi mismo). Motion interpola NUMEROS en JS y escribe el valor resuelto, asi
       que ese problema no se da. Solo en escritorio: en movil el ancho no cambia. */
    <Motion.aside
      className={`sidebar${mobileOpen ? ' sidebar--open' : ''}${collapsed ? ' sidebar--collapsed' : ''}`}
      animate={esEscritorio ? { width: estrecho ? 64 : 232 } : {}}
      transition={RESORTE}
    >
      {/* Logo */}
      <div className={`sidebar__header${estrecho ? ` ${CABECERA_COLAPSADA}` : ''}`}>
        <div className={`sidebar__logo${estrecho ? ` ${OCULTO_AL_COLAPSAR}` : ''}`}>
          <span className="sidebar__logo-text">SIGOT</span>
        </div>
        <div className="sidebar__header-actions">
          <div className={`sidebar__header-bells${estrecho ? ` ${OCULTO_AL_COLAPSAR}` : ''}`}>
            <StockAlertBell />
            {esAdminOSuperAdmin && <NovedadAlertBell />}
          </div>
          {/* Botón de colapso — solo escritorio (en móvil el sidebar es drawer) */}
          <button
            className="sidebar__collapse-btn"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <MdMenuOpen size={20} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        {visibleNav.map((item) => {
          if (item.type === 'section') {
            return (
              <div
                key={item.label}
                className={`sidebar__section-label${estrecho ? ` ${OCULTO_AL_COLAPSAR}` : ''}`}
              >{item.label}</div>
            );
          }

          if (item.type === 'link') {
            return (
              <TooltipLateral key={item.to} texto={item.label} activo={estrecho}>
                <NavLink
                  to={item.to}
                  /* El title nativo se quita cuando hay tooltip propio: si no,
                     el navegador pinta ADEMAS su globo gris encima del nuestro. */
                  title={estrecho ? undefined : item.label}
                  className={({ isActive }) => `sidebar__item${isActive ? ' sidebar__item--active' : ''}${estrecho ? ` ${ITEM_COLAPSADO}` : ''}`}
                >
                  <item.icon size={20} className="sidebar__item-icon" />
                  <span className={`sidebar__item-label${estrecho ? ` ${OCULTO_AL_COLAPSAR}` : ''}`}>{item.label}</span>
                </NavLink>
              </TooltipLateral>
            );
          }

          if (item.type === 'group') {
            const isGroupActive = item.children.some(c => location.pathname.startsWith(c.to));
            const isOpen = openGroups[item.name];

            return (
              <div key={item.name} className="sidebar__group">
                <TooltipLateral texto={item.name} activo={estrecho}>
                  <button
                    className={`sidebar__group-header${isGroupActive ? ' sidebar__group-header--active' : ''}${estrecho ? ` ${ITEM_COLAPSADO}` : ''}`}
                    onClick={() => toggleGroup(item.name)}
                    title={estrecho ? undefined : item.name}
                  >
                    <item.icon size={20} className="sidebar__item-icon" />
                    <span className={`sidebar__item-label${estrecho ? ` ${OCULTO_AL_COLAPSAR}` : ''}`}>{item.name}</span>
                    {/* El chevron sobra sin texto al lado: al pulsar en estrecho
                        el sidebar se expande (ver toggleGroup), no se despliega. */}
                    <MdChevronRight
                      size={16}
                      className={`sidebar__group-chevron${isOpen ? ' sidebar__group-chevron--open' : ''}${estrecho ? ` ${OCULTO_AL_COLAPSAR}` : ''}`}
                    />
                  </button>
                </TooltipLateral>
                <div className={`sidebar__group-children${isOpen ? ' sidebar__group-children--open' : ''}${estrecho ? ` ${OCULTO_AL_COLAPSAR}` : ''}`}>
                  {item.children.map(child => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      className={({ isActive }) => `sidebar__item sidebar__item--child${isActive ? ' sidebar__item--active' : ''}`}
                    >
                      <child.icon size={18} className="sidebar__item-icon" />
                      <span className="sidebar__item-label">{child.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          }

          return null;
        })}
      </nav>

      {/* Footer: perfil + cerrar sesión (dropdown al hacer clic). */}
      <div className="sidebar__footer">
        <div className="sidebar__user-wrap" ref={profileRef}>
          {profileOpen && (
            <div className="sidebar__profile-dropdown">
              <button className="sidebar__profile-item" onClick={() => { setProfileOpen(false); handleLogout(); }}>
                <MdLogout size={16} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
          <TooltipLateral texto={empleado?.Nombre || 'Perfil'} activo={estrecho}>
            <div
              className={`sidebar__user cursor-pointer${estrecho ? ` ${PERFIL_COLAPSADO}` : ''}`}
              onClick={() => setProfileOpen(o => !o)}
            >
              {empleado && (
                <>
                  <div className="sidebar__user-avatar">
                    {(empleado.Foto_url || empleado.Foto)
                      ? <img src={empleado.Foto_url || empleado.Foto} alt="" className="size-full rounded-full object-cover" />
                      : empleado.Nombre?.charAt(0).toUpperCase()
                    }
                  </div>
                  <div className={`sidebar__user-info${estrecho ? ` ${OCULTO_AL_COLAPSAR}` : ''}`}>
                    <span className="sidebar__user-name">{empleado.Nombre}</span>
                    {/* Debajo del nombre va el CORREO, no el rol. El rol ya se ve
                        en Cuentas y en el propio perfil; el correo es lo que
                        identifica con cual de varias cuentas estas dentro, que es
                        la pregunta que uno le hace a este bloque. Si no viniera
                        en la sesion, se cae al rol en vez de dejar el hueco. */}
                    <span className="sidebar__user-role">
                      {empleado.Correo || empleado.rol || empleado.Rol || 'Administrador'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </TooltipLateral>
        </div>
      </div>
    </Motion.aside>
  );
}
