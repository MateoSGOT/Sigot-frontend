import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const SidebarContext = createContext({
  mobileOpen: false,
  openMobile: () => {},
  closeMobile: () => {},
  toggleMobile: () => {},
});

/* La clave del colapso persistido se LIMPIA, no se conserva. El sidebar ya no
   tiene estado de colapso: vive siempre como riel y se expande al pasar el
   cursor (ver Sidebar.jsx). Quien quedo con 'sigot_sidebar_collapsed' en 1 --
   y eso incluye a cualquiera que lo pulsara cuando el boton estaba roto y
   dejaba el panel sin salida -- se lo encuentra borrado al cargar, en vez de
   arrastrar una clave muerta en localStorage para siempre. */
const COLLAPSE_KEY = 'sigot_sidebar_collapsed';

export function SidebarProvider({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const openMobile   = useCallback(() => setMobileOpen(true), []);
  const closeMobile  = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen(o => !o), []);

  useEffect(() => {
    try { localStorage.removeItem(COLLAPSE_KEY); } catch { /* ignore */ }
  }, []);

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
    <SidebarContext.Provider value={{ mobileOpen, openMobile, closeMobile, toggleMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
