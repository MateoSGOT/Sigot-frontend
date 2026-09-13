import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const SidebarContext = createContext({
  mobileOpen: false,
  openMobile: () => {},
  closeMobile: () => {},
  toggleMobile: () => {},
  collapsed: false,
  toggleCollapsed: () => {},
  setCollapsed: () => {},
});

const COLLAPSE_KEY = 'sigot_sidebar_collapsed';

export function SidebarProvider({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const openMobile   = useCallback(() => setMobileOpen(true), []);
  const closeMobile  = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen(o => !o), []);

  // Colapso (solo escritorio): se recuerda entre recargas.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const toggleCollapsed = useCallback(() => setCollapsed(c => !c), []);
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  // Con el drawer móvil abierto, bloqueamos el scroll del body para que la página de
  // atrás no se mueva -- y se cierra con Escape. Centralizado aquí (antes cada consumidor
  // del sidebar -- Layout.jsx del panel principal y PortalSidebar.jsx del portal del
  // cliente -- reimplementaba este mismo par de efectos por su cuenta) para que
  // cualquier pantalla que use el sidebar (actual o futura) se comporte igual sin
  // duplicar la lógica.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeMobile(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, closeMobile]);

  return (
    <SidebarContext.Provider value={{ mobileOpen, openMobile, closeMobile, toggleMobile, collapsed, toggleCollapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
