import React, { createContext, useContext, useState, useCallback } from 'react';

const SidebarContext = createContext({
  mobileOpen: false,
  openMobile: () => {},
  closeMobile: () => {},
  toggleMobile: () => {},
});

export function SidebarProvider({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const openMobile   = useCallback(() => setMobileOpen(true), []);
  const closeMobile  = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen(o => !o), []);
  return (
    <SidebarContext.Provider value={{ mobileOpen, openMobile, closeMobile, toggleMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
