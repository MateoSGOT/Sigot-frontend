import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { MdLogout, MdChevronRight } from 'react-icons/md';
import { logout } from '../../../features/auth/slices/authSlice';
import StockAlertBell from '../StockAlertBell/StockAlertBell.jsx';
import NovedadAlertBell from '../NovedadAlertBell/NovedadAlertBell.jsx';
import { useSidebar } from '../../contexts/SidebarContext.jsx';
// Estructura y filtrado por permisos: compartidos con BottomNav. Ver navStructure.js
// -- están afuera para que exista un solo criterio de visibilidad por rol.
import { navConCuentas, buildVisibleNav } from './navStructure.js';
import { motion as Motion } from 'motion/react';
import { useMediaQuery, mq } from '../../styles/breakpoints.js';
import { RESORTE } from '../../styles/movimiento.js';
import './Sidebar.css';

/* ── Riel que se expande al pasar el cursor ────────────────────────────────
   Antes esto era un boton de colapsar, y estaba roto de tres maneras: el
   wordmark y las campanas no se ocultaban (sus reglas en Sidebar.css declaran
   display y le ganan a una utilidad `hidden`), el avatar de 32px no cabia en
   los 28 disponibles, y el propio boton quedaba empujado fuera del panel de
   64px, donde overflow:hidden lo recortaba. Sin boton alcanzable no habia forma
   de volver a expandir.

   Ahora el panel vive en 64px y crece al entrar el cursor. Lo visual lo resuelve
   la clase .sidebar--riel DENTRO de Sidebar.css, no utilidades desde aqui: esas
   propiedades ya estan declaradas alli y esa hoja no esta estratificada.

   EL ANCHO SI LO ANIMA MOTION, por lo mismo que antes: Sidebar.css lleva
   `transition: none` porque transicionar width entre valores var() se queda
   pegado en algunos motores. Motion interpola numeros.

   Se expande tambien con :focus-within, no solo con el cursor: tabulando por el
   menu hay que poder leer donde se esta. */

export default function Sidebar() {
  const dispatch  = useDispatch();
  const location  = useLocation();
  const { empleado, cliente, permisos } = useSelector((state) => state.auth);
  const { mobileOpen } = useSidebar();
  /* Solo escritorio: por debajo de 1024 el sidebar es un cajon que entra con
     transform y conserva su ancho. Sin esta condicion, el ancho en linea que
     pone Motion se aplicaria tambien en movil y encogeria el cajon. */
  const esEscritorio = useMediaQuery(mq.desktop);
  const [encima, setEncima] = useState(false);
  const riel = esEscritorio && !encima;
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
    /* Ya no hay que expandir a mano: si el cursor esta sobre el grupo, el panel
       ya esta expandido y los hijos tienen donde mostrarse. */
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
      className={`sidebar${mobileOpen ? ' sidebar--open' : ''}${riel ? ' sidebar--riel' : ''}`}
      animate={esEscritorio ? { width: riel ? 64 : 232 } : {}}
      transition={RESORTE}
      onMouseEnter={() => setEncima(true)}
      onMouseLeave={() => setEncima(false)}
      /* focus-within via JS: al tabular dentro del menu el panel se abre igual
         que con el raton, y al salir el foco se vuelve a cerrar. */
      onFocusCapture={() => setEncima(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setEncima(false);
      }}
    >
      {/* Logo */}
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <span className="sidebar__logo-text">SIGOT</span>
        </div>
        {/* Marca compacta: solo se ve en el riel, donde "SIGOT" con su tracking
            de 0.2em no cabe ni de lejos en 62px. La muestra y la oculta
            Sidebar.css (.sidebar--riel .sidebar__marca-mini). */}
        <span className="sidebar__marca-mini" aria-hidden="true">S</span>
        <div className="sidebar__header-actions">
          <div className="sidebar__header-bells">
            <StockAlertBell />
            {esAdminOSuperAdmin && <NovedadAlertBell />}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        {visibleNav.map((item) => {
          if (item.type === 'section') {
            return (
              <div key={item.label} className="sidebar__section-label">{item.label}</div>
            );
          }

          if (item.type === 'link') {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) => `sidebar__item${isActive ? ' sidebar__item--active' : ''}`}
              >
                <item.icon size={20} className="sidebar__item-icon" />
                <span className="sidebar__item-label">{item.label}</span>
              </NavLink>
            );
          }

          if (item.type === 'group') {
            const isGroupActive = item.children.some(c => location.pathname.startsWith(c.to));
            const isOpen = openGroups[item.name];

            return (
              <div key={item.name} className="sidebar__group">
                <button
                  className={`sidebar__group-header${isGroupActive ? ' sidebar__group-header--active' : ''}`}
                  onClick={() => toggleGroup(item.name)}
                  title={item.name}
                >
                  <item.icon size={20} className="sidebar__item-icon" />
                  <span className="sidebar__item-label">{item.name}</span>
                  <MdChevronRight
                    size={16}
                    className={`sidebar__group-chevron${isOpen ? ' sidebar__group-chevron--open' : ''}`}
                  />
                </button>
                <div className={`sidebar__group-children${isOpen ? ' sidebar__group-children--open' : ''}`}>
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
          <div
            className="sidebar__user cursor-pointer"
            onClick={() => setProfileOpen(o => !o)}
            title={empleado?.Nombre}
          >
              {empleado && (
                <>
                  <div className="sidebar__user-avatar">
                    {(empleado.Foto_url || empleado.Foto)
                      ? <img src={empleado.Foto_url || empleado.Foto} alt="" className="size-full rounded-full object-cover" />
                      : empleado.Nombre?.charAt(0).toUpperCase()
                    }
                  </div>
                  <div className="sidebar__user-info">
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
        </div>
      </div>
    </Motion.aside>
  );
}
