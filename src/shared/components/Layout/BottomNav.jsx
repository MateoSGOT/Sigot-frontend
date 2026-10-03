import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { MdMoreHoriz } from 'react-icons/md';
import { useSidebar } from '../../contexts/SidebarContext.jsx';
import { navConCuentas, buildVisibleNav, linksParaBarraInferior } from '../Sidebar/navStructure.js';
import './BottomNav.css';

/* ═══════════════════════════════════════════════════════════════════════════
   Barra de navegación inferior — solo móvil (<1024px; el CSS la oculta arriba).

   Por qué una barra inferior y no solo el drawer: el mecánico opera el celular
   con una mano, muchas veces con guantes, y el pulgar no alcanza la esquina
   superior izquierda donde vive el botón de hamburguesa. Los cuatro destinos
   que más usa quedan a un toque, en la zona que el pulgar cubre sin recolocar
   la mano. El drawer sigue existiendo detrás de "Más" para todo lo demás.

   Los permisos NO se recalculan acá: se reutilizan navConCuentas +
   buildVisibleNav del Sidebar, para que no haya dos criterios de visibilidad.
   ═══════════════════════════════════════════════════════════════════════════ */
export default function BottomNav() {
  const { empleado, cliente, permisos } = useSelector((state) => state.auth);
  const { toggleMobile, mobileOpen } = useSidebar();

  const esSuperAdmin = !!(empleado?.EsSuperAdmin || cliente?.EsSuperAdmin);
  const visibleNav = buildVisibleNav(navConCuentas(esSuperAdmin), permisos, esSuperAdmin);
  const links = linksParaBarraInferior(visibleNav, 4);

  // Un rol sin ningún módulo visible no necesita barra (y sin ítems se vería
  // como una franja vacía). El drawer sigue accesible desde la cabecera móvil.
  if (links.length === 0) return null;

  return (
    <nav className="bottomnav" aria-label="Navegación principal">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) => `bottomnav__item${isActive ? ' bottomnav__item--active' : ''}`}
        >
          <link.icon size={22} className="bottomnav__icon" aria-hidden="true" />
          <span className="bottomnav__label">{link.label}</span>
        </NavLink>
      ))}

      <button
        type="button"
        className={`bottomnav__item bottomnav__item--more${mobileOpen ? ' bottomnav__item--active' : ''}`}
        onClick={toggleMobile}
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? 'Cerrar menú completo' : 'Abrir menú completo'}
      >
        <MdMoreHoriz size={22} className="bottomnav__icon" aria-hidden="true" />
        <span className="bottomnav__label">Más</span>
      </button>
    </nav>
  );
}
