import React, { createContext, useContext } from 'react';

const SidebarContext = createContext({ collapsed: false, setCollapsed: () => {} });

export function SidebarProvider({ children }) {
  return (
    <SidebarContext.Provider value={{ collapsed: false, setCollapsed: () => {} }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
