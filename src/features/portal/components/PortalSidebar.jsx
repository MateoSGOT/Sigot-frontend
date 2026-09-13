import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  MdHome, MdDirectionsCar, MdAssignment, MdCalendarMonth,
  MdExitToApp, MdClose, MdMenuOpen,
} from 'react-icons/md';
import { logout } from '../../auth/slices/authSlice.js';
import PortalNotifBell from './PortalNotifBell.jsx';
import { useSidebar } from '../../../shared/contexts/SidebarContext.jsx';
import '../../../shared/components/Sidebar/Sidebar.css';

const NAV_ITEMS = [
  { key: 'cuenta',    Icon: MdHome,          label: 'Mi Cuenta'     },
  { key: 'vehiculos', Icon: MdDirectionsCar, label: 'Mis Vehículos' },
  { key: 'ordenes',   Icon: MdAssignment,    label: 'Mis Órdenes'   },
  { key: 'citas',     Icon: MdCalendarMonth, label: 'Mis Citas'     },
];

export default function PortalSidebar({ activeTab, onTabChange }) {
  const dispatch    = useDispatch();
  const navigate    = useNavigate();
  const { cliente } = useSelector(s => s.auth);
  // Mismo SidebarContext que usa el sidebar del panel principal (Sidebar.jsx vía
  // Layout.jsx) -- antes este componente llevaba su propio useState local para
  // mobileOpen/collapsed, duplicando el estado y perdiendo el colapso persistido en
  // localStorage que sí tiene el panel principal. El hamburger + overlay del drawer
  // móvil los renderiza el propio PortalPage vía <MobileSidebarChrome />, igual que
  // Layout.jsx hace para el panel principal.
  const { mobileOpen, closeMobile, collapsed, toggleCollapsed } = useSidebar();

  const handleLogout = () => { dispatch(logout()); window.location.replace('/login'); };

  const handleNav = (key) => {
    onTabChange(key);
    closeMobile();
  };

  return (
      // "sidebar--open" (no "portal-sidebar--open") a propósito: es la MISMA clase que usa
      // el drawer móvil del panel principal (Sidebar.jsx) -- así hereda directo de
      // Sidebar.css el mismo transform/sombra/z-index (1200, por encima del overlay 1100),
      // en vez de una copia propia que antes tenía su propio z-index (100), mucho más bajo
      // y desalineado de la escala real de capas fijas de la app (ver Layout.css).
      <aside className={`sidebar portal-sidebar${mobileOpen ? ' sidebar--open' : ''}${collapsed ? ' sidebar--collapsed' : ''}`}>
        <div className="sidebar__header">
          <div className="sidebar__logo">
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
              <span className="sidebar__logo-text">SIGOT</span>
              <span className="portal-sidebar__subtitle">Portal del Cliente</span>
            </div>
          </div>
          <div className="sidebar__header-actions">
            <div className="sidebar__header-bells">
              <PortalNotifBell onNavigate={onTabChange} />
            </div>
            <button
              className="sidebar__collapse-btn"
              onClick={toggleCollapsed}
              title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
              aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
              <MdMenuOpen size={20} />
            </button>
            <button className="portal-sidebar-close" onClick={closeMobile} aria-label="Cerrar menú">
              <MdClose size={18} />
            </button>
          </div>
        </div>

        <nav className="sidebar__nav">
          {NAV_ITEMS.map(({ key, Icon, label }) => (
            <button
              key={key}
              className={`sidebar__item portal-sidebar__item${activeTab === key ? ' sidebar__item--active' : ''}`}
              onClick={() => handleNav(key)}
            >
              <Icon size={20} className="sidebar__item-icon" />
              <span className="sidebar__item-label">{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__user-avatar">
              {cliente?.Nombre?.charAt(0)?.toUpperCase()}
            </div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">{cliente?.Nombre}</span>
              <span className="sidebar__user-role">Cliente</span>
            </div>
            <button className="sidebar__logout" onClick={handleLogout} title="Cerrar sesión">
              <MdExitToApp size={16} />
            </button>
          </div>
        </div>
      </aside>
  );
}
