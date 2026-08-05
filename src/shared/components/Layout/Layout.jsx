import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { MdMenu } from 'react-icons/md';
import Sidebar from '../Sidebar/Sidebar.jsx';
import { SidebarProvider, useSidebar } from '../../contexts/SidebarContext.jsx';
import './Layout.css';

function LayoutInner() {
  const { mobileOpen, toggleMobile, closeMobile } = useSidebar();
  const location = useLocation();

  // Cerrar el drawer al cambiar de ruta y con la tecla Escape.
  useEffect(() => { closeMobile(); }, [location.pathname, closeMobile]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeMobile(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeMobile]);

  return (
    <div className="layout">
      <button className="layout__hamburger" onClick={toggleMobile} aria-label="Abrir menú">
        <MdMenu size={24} />
      </button>
      <Sidebar />
      <div
        className={`layout__overlay${mobileOpen ? ' layout__overlay--show' : ''}`}
        onClick={closeMobile}
        aria-hidden="true"
      />
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
