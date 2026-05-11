import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  MdDashboard, MdPeople, MdDirectionsCar, MdBuild, MdShoppingCart,
  MdMiscellaneousServices, MdAssignment, MdEventNote,
  MdNewReleases, MdSecurity, MdCategory, MdLocalShipping,
  MdLogout, MdPerson,
  MdPeopleAlt, MdStorage, MdChevronRight,
} from 'react-icons/md';
import { logout } from '../../../features/auth/slices/authSlice';
import './Sidebar.css';

const NAV_STRUCTURE = [
  { type: 'section', label: 'Menú principal' },
  { type: 'link', to: '/dashboard', icon: MdDashboard, label: 'Dashboard' },
  {
    type: 'group', name: 'Usuarios', icon: MdPeopleAlt,
    children: [
      { to: '/empleados', icon: MdPeople, label: 'Empleados' },
      { to: '/clientes',  icon: MdPerson, label: 'Clientes' },
    ],
  },
  { type: 'link', to: '/vehiculos',  icon: MdDirectionsCar,        label: 'Vehículos' },
  { type: 'link', to: '/agenda',     icon: MdEventNote,             label: 'Agenda' },
  { type: 'link', to: '/ordenes',    icon: MdAssignment,            label: 'Órdenes' },
  { type: 'link', to: '/servicios',  icon: MdMiscellaneousServices, label: 'Servicios' },
  {
    type: 'group', name: 'Inventario', icon: MdStorage,
    children: [
      { to: '/repuestos',  icon: MdBuild,    label: 'Repuestos' },
      { to: '/categorias', icon: MdCategory, label: 'Categorías' },
    ],
  },
  { type: 'link', to: '/proveedores', icon: MdLocalShipping, label: 'Proveedores' },
  { type: 'link', to: '/compras',     icon: MdShoppingCart,  label: 'Compras' },
  { type: 'link', to: '/novedades',   icon: MdNewReleases,   label: 'Novedades' },
  { type: 'section', label: 'Configuración' },
  { type: 'link', to: '/roles', icon: MdSecurity, label: 'Roles' },
];

// Routes visible to the Técnico role only
const TECNICO_PATHS = new Set(['/vehiculos', '/servicios', '/repuestos', '/categorias', '/ordenes']);

function filterNavForRole(nav, rolNombre) {
  const isTecnico = rolNombre === 'Técnico' || rolNombre === 'Tecnico';
  if (!isTecnico) return nav;

  const filtered = [];
  for (const item of nav) {
    if (item.type === 'section') {
      filtered.push(item);
    } else if (item.type === 'link' && TECNICO_PATHS.has(item.to)) {
      filtered.push(item);
    } else if (item.type === 'group') {
      const visibleChildren = item.children.filter(c => TECNICO_PATHS.has(c.to));
      if (visibleChildren.length > 0) filtered.push({ ...item, children: visibleChildren });
    }
  }

  // Drop section labels that have no visible items after them
  return filtered.filter((item, i, arr) => {
    if (item.type !== 'section') return true;
    const nextNonSection = arr.slice(i + 1).find(x => x.type !== 'section');
    return !!nextNonSection;
  });
}

export default function Sidebar() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { empleado } = useSelector((state) => state.auth);

  const visibleNav = filterNavForRole(NAV_STRUCTURE, empleado?.Rol);

  const [openGroups, setOpenGroups] = useState(() => {
    const groups = {};
    NAV_STRUCTURE.forEach(item => {
      if (item.type === 'group') {
        groups[item.name] = item.children.some(c => location.pathname.startsWith(c.to));
      }
    });
    return groups;
  });

  const toggleGroup = (name) => setOpenGroups(p => ({ ...p, [name]: !p[name] }));

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <div className="sidebar__logo-icon">S</div>
          <span className="sidebar__logo-text">SIGOT</span>
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

      {/* Footer */}
      <div className="sidebar__footer">
        <div className="sidebar__user">
          {empleado && (
            <>
              <div className="sidebar__user-avatar">
                {empleado.Foto
                  ? <img src={empleado.Foto} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  : empleado.Nombre?.charAt(0).toUpperCase()
                }
              </div>
              <div className="sidebar__user-info">
                <span className="sidebar__user-name">{empleado.Nombre}</span>
                <span className="sidebar__user-role">{empleado.Rol || 'Administrador'}</span>
              </div>
            </>
          )}
          <button className="sidebar__logout" onClick={handleLogout} title="Cerrar sesión">
            <MdLogout size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
