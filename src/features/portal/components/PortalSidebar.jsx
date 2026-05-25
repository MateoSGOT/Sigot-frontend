import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  MdHome, MdDirectionsCar, MdAssignment, MdCalendarMonth,
  MdExitToApp, MdMenu, MdClose,
} from 'react-icons/md';
import { logout } from '../../auth/slices/authSlice.js';
import '../../../shared/components/Sidebar/Sidebar.css';

const NAV_ITEMS = [
  { key: 'cuenta',    Icon: MdHome,          label: 'Mi Cuenta'     },
  { key: 'vehiculos', Icon: MdDirectionsCar, label: 'Mis Vehículos' },
  { key: 'ordenes',   Icon: MdAssignment,    label: 'Mis Órdenes'   },
  { key: 'citas',     Icon: MdCalendarMonth, label: 'Mis Citas'     },
];

export default function PortalSidebar({ activeTab, onTabChange }) {
  const dispatch    = useDispatch();
  const { cliente } = useSelector(s => s.auth);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => dispatch(logout());

  const handleNav = (key) => {
    onTabChange(key);
    setMobileOpen(false);
  };

  return (
    <>
      <button className="portal-hamburger" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
        <MdMenu size={22} />
      </button>

      {mobileOpen && (
        <div className="portal-sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar portal-sidebar${mobileOpen ? ' portal-sidebar--open' : ''}`}>
        <div className="sidebar__header">
          <div className="sidebar__logo">
            <div className="sidebar__logo-icon">S</div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span className="sidebar__logo-text">SIGOT</span>
              <span className="portal-sidebar__subtitle">Portal del Cliente</span>
            </div>
          </div>
          <button className="portal-sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú">
            <MdClose size={18} />
          </button>
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
    </>
  );
}
