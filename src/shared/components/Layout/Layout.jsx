import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar.jsx';
import MobileSidebarChrome from './MobileSidebarChrome.jsx';
import { SidebarProvider, useSidebar } from '../../contexts/SidebarContext.jsx';
import './Layout.css';

function LayoutInner() {
  const { closeMobile, collapsed } = useSidebar();
  const location = useLocation();

  // Cerrar el drawer al cambiar de ruta (el bloqueo de scroll del body y el cierre con
  // Escape ya los cubre SidebarProvider -- ver SidebarContext.jsx -- para que el portal
  // del cliente, que no navega por rutas sino por pestañas, también los tenga gratis).
  useEffect(() => { closeMobile(); }, [location.pathname, closeMobile]);

  return (
    <div className={`layout${collapsed ? ' layout--collapsed' : ''}`}>
      <MobileSidebarChrome />
      <Sidebar />
      <main className="layout__main">
        <Outlet />
      </main>
    </div>
  );
}

export default function Layout() {
  return (
    <SidebarProvider>
      <LayoutInner />
    </SidebarProvider>
  );
}
