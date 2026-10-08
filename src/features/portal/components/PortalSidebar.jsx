import React, { useState } from 'react';
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
import { motion as Motion } from 'motion/react';
import { useMediaQuery, mq } from '../../../shared/styles/breakpoints.js';
import { RESORTE } from '../../../shared/styles/movimiento.js';

const NAV_ITEMS = [
  { key: 'cuenta',    Icon: MdHome,          label: 'Mi Cuenta'     },
  { key: 'vehiculos', Icon: MdDirectionsCar, label: 'Mis Vehículos' },
  { key: 'ordenes',   Icon: MdAssignment,    label: 'Mis Órdenes'   },
  { key: 'citas',     Icon: MdCalendarMonth, label: 'Mis Citas'     },
];

/* ── Clases propias del sidebar del portal, en utilidades ──────────────────
   Eran las ultimas tres reglas de PortalPage.css, el ultimo .css de pagina que
   quedaba en src/features. El <aside> reutiliza .sidebar/.sidebar--open de
   Sidebar.css; aqui solo van sus diferencias.

   NO hizo falta estratificar Sidebar.css para que estas utilidades ganen:
   .sidebar__item declara display, gap, padding, radio, color, tamano y peso,
   pero NO width, background, border, text-align ni font-family -- que es
   justamente lo que hay que neutralizar aqui. No compiten, asi que no hay nada
   que ceder en la cascada. (Comprobado leyendo la regla, no supuesto.)

   El selector viejo era `.portal-sidebar .portal-sidebar__item`, con dos clases
   para ganar especificidad. Con utilidades esa gimnasia sobra. */

/* Subtitulo bajo el wordmark. El cobalto claro original (rgba(109,140,255,.78))
   no alcanzaba contraste de etiqueta sobre el vidrio claro; usa el par del
   sistema. */
const SUBTITULO = 'mt-[3px] text-caption font-bold uppercase tracking-wide text-primary-soft-on';

/* El portal navega por PESTANAS, no por rutas, asi que sus items son <button> y
   no <NavLink>: hay que neutralizar los defaults del boton para que se vean
   igual que los enlaces del panel. */
const ITEM_BOTON = 'w-full cursor-pointer border-0 bg-transparent text-left font-[inherit]';

/* Cerrar el cajon: solo por debajo de 1024px (en escritorio el panel es fijo).
   max-lg: es exactamente el @media (max-width: 1023px) que habia.
   Los tokens --sidebar-* no son --color-*, asi que Tailwind no genera utilidad
   para ellos y se referencian como valor arbitrario. */
/* min-h tactil: medido en 26px. Es el boton que cierra el cajon en movil. */
const BOTON_CERRAR = 'hidden max-lg:flex max-lg:min-h-[48px] max-lg:min-w-[48px] items-center justify-center '
  + 'ml-auto cursor-pointer rounded-sm border-0 bg-transparent p-xs '  // `background: none`
  // en forma larga tambien pone el color en transparent, no solo la imagen:
  // bg-none solo limpiaria background-image y dejaria el gris del boton.
  + 'text-[var(--sidebar-icon)] transition-[background-color,color] duration-150 '
  + 'hover:bg-[var(--sidebar-hover)] hover:text-text';

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
  const { mobileOpen, closeMobile } = useSidebar();
  /* Mismo riel con expansion por cursor que el panel principal: los dos
     comparten .sidebar y .sidebar--riel de Sidebar.css, asi que basta con
     aplicar la clase y animar el ancho igual. */
  const esEscritorio = useMediaQuery(mq.desktop);
  const [encima, setEncima] = useState(false);
  const riel = esEscritorio && !encima;

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
      <Motion.aside
        className={`sidebar${mobileOpen ? ' sidebar--open' : ''}${riel ? ' sidebar--riel' : ''}`}
        animate={esEscritorio ? { width: riel ? 64 : 232 } : {}}
        transition={RESORTE}
        onMouseEnter={() => setEncima(true)}
        onMouseLeave={() => setEncima(false)}
        onFocusCapture={() => setEncima(true)}
        onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setEncima(false); }}
      >
        <div className="sidebar__header">
          <div className="sidebar__logo">
            <div className="flex flex-col leading-[1.25]">
              <span className="sidebar__logo-text">SIGOT</span>
              <span className={SUBTITULO}>Portal del Cliente</span>
            </div>
          </div>
          {/* Marca compacta del riel: la muestra Sidebar.css, misma regla que en
              el panel principal. */}
          <span className="sidebar__marca-mini" aria-hidden="true">S</span>
          <div className="sidebar__header-actions">
            <div className="sidebar__header-bells">
              <PortalNotifBell onNavigate={onTabChange} />
            </div>
            <button className={BOTON_CERRAR} onClick={closeMobile} aria-label="Cerrar menú">
              <MdClose size={18} />
            </button>
          </div>
        </div>

        <nav className="sidebar__nav">
          {NAV_ITEMS.map(({ key, Icon, label }) => (
            <button
              key={key}
              className={`sidebar__item ${ITEM_BOTON}${activeTab === key ? ' sidebar__item--active' : ''}`}
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
            <button className="sidebar__logout max-lg:min-h-[48px]" onClick={handleLogout} title="Cerrar sesión">
              <MdExitToApp size={16} />
            </button>
          </div>
        </div>
      </Motion.aside>
  );
}
