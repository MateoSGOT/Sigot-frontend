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

  return (
    <SidebarContext.Provider value={{ mobileOpen, openMobile, closeMobile, toggleMobile, collapsed, toggleCollapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
