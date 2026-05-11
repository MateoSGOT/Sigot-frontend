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
  { type: 'link', to: '/dashboard', icon: MdDashboard,           label: 'Dashboard',   permiso: 'DASHBOARD' },
  {
    type: 'group', name: 'Usuarios', icon: MdPeopleAlt,
    children: [
      { to: '/empleados', icon: MdPeople, label: 'Empleados', permiso: 'EMPLEADOS' },
      { to: '/clientes',  icon: MdPerson, label: 'Clientes',  permiso: 'CLIENTES'  },
    ],
  },
  { type: 'link', to: '/vehiculos',  icon: MdDirectionsCar,        label: 'Vehículos',   permiso: 'VEHICULOS'   },
  { type: 'link', to: '/agenda',     icon: MdEventNote,             label: 'Agenda',      permiso: 'AGENDA'      },
  { type: 'link', to: '/ordenes',    icon: MdAssignment,            label: 'Órdenes',     permiso: 'ORDENES'     },
  { type: 'link', to: '/servicios',  icon: MdMiscellaneousServices, label: 'Servicios',   permiso: 'SERVICIOS'   },
  {
    type: 'group', name: 'Inventario', icon: MdStorage,
    children: [
      { to: '/repuestos',  icon: MdBuild,    label: 'Repuestos',  permiso: 'REPUESTOS'  },
      { to: '/categorias', icon: MdCategory, label: 'Categorías', permiso: 'CATEGORIAS' },
    ],
  },
  { type: 'link', to: '/proveedores', icon: MdLocalShipping, label: 'Proveedores', permiso: 'PROVEEDORES' },
  { type: 'link', to: '/compras',     icon: MdShoppingCart,  label: 'Compras',     permiso: 'COMPRAS'     },
  { type: 'link', to: '/novedades',   icon: MdNewReleases,   label: 'Novedades',   permiso: 'NOVEDADES'   },
  { type: 'section', label: 'Configuración' },
  { type: 'link', to: '/roles', icon: MdSecurity, label: 'Roles', permiso: 'ROLES' },
];

function buildVisibleNav(nav, permisos) {
  // permisos === null → todavía cargando → mostrar todo sin flash
  const canSee = (permiso) => {
    if (!permiso || permisos === null) return true;
    if (permiso === 'DASHBOARD') return permisos.some(p => p.startsWith('DASHBOARD.'));
    return permisos.includes(`${permiso}.LISTAR`);
  };

  const filtered = nav.reduce((acc, item) => {
    if (item.type === 'section') { acc.push(item); return acc; }
    if (item.type === 'link') {
      if (canSee(item.permiso)) acc.push(item);
      return acc;
    }
    if (item.type === 'group') {
      const visible = item.children.filter(c => canSee(c.permiso));
      if (visible.length > 0) acc.push({ ...item, children: visible });
      return acc;
    }
    return acc;
  }, []);

  // Eliminar section labels que no tienen ítems después
  return filtered.filter((item, i, arr) => {
    if (item.type !== 'section') return true;
    return arr.slice(i + 1).some(x => x.type !== 'section');
  });
}

export default function Sidebar() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { empleado, permisos } = useSelector((state) => state.auth);

  const visibleNav = buildVisibleNav(NAV_STRUCTURE, permisos);

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
