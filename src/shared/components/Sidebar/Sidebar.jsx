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
import './Sidebar.css';

export default function Sidebar() {
  const dispatch  = useDispatch();
  const location  = useLocation();
  const { empleado, cliente, permisos } = useSelector((state) => state.auth);
  const { mobileOpen, collapsed, toggleCollapsed, setCollapsed } = useSidebar();
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
    <aside className={`sidebar${mobileOpen ? ' sidebar--open' : ''}${collapsed ? ' sidebar--collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <span className="sidebar__logo-text">SIGOT</span>
        </div>
        <div className="sidebar__header-actions">
          <div className="sidebar__header-bells">
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
          <div className="sidebar__user" onClick={() => setProfileOpen(o => !o)} style={{ cursor: 'pointer' }}>
            {empleado && (
              <>
                <div className="sidebar__user-avatar">
                  {(empleado.Foto_url || empleado.Foto)
                    ? <img src={empleado.Foto_url || empleado.Foto} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    : empleado.Nombre?.charAt(0).toUpperCase()
                  }
                </div>
                <div className="sidebar__user-info">
                  <span className="sidebar__user-name">{empleado.Nombre}</span>
                  <span className="sidebar__user-role">{empleado.Rol || empleado.rol || 'Administrador'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
