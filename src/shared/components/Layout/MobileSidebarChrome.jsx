import React from 'react';
import { MdMenu } from 'react-icons/md';
import { useSidebar } from '../../contexts/SidebarContext.jsx';
// Autocontenido: cualquier pantalla que renderice este componente obtiene sus estilos
// sin tener que acordarse de importar Layout.css por su cuenta.
import './Layout.css';

// Botón de hamburguesa + fondo oscuro del drawer móvil, compartidos por CUALQUIER
// pantalla que use el sidebar (panel principal vía Layout.jsx, portal del cliente vía
// PortalPage.jsx) -- antes cada una tenía su propia copia de este mismo par de
// elementos, con estilos/z-index ligeramente distintos entre sí (y respecto al resto
// de capas fijas de la app, ver la escala documentada en Layout.css). Al vivir en un
// solo lugar, ambas pantallas quedan consistentes por construcción: un ajuste aquí
// (color, tamaño, z-index) se aplica a las dos a la vez, sin volver a divergir.
export default function MobileSidebarChrome() {
  const { mobileOpen, toggleMobile, closeMobile } = useSidebar();
  return (
    <>
      <button className="layout__hamburger" onClick={toggleMobile} aria-label="Abrir menú">
        <MdMenu size={22} />
      </button>
      <div
        className={`layout__overlay${mobileOpen ? ' layout__overlay--show' : ''}`}
        onClick={closeMobile}
        aria-hidden="true"
      />
    </>
  );
}
