import React, { useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion as Motion, AnimatePresence } from 'motion/react';

/* ═══════════════════════════════════════════════════════════════════════════
   TOOLTIP LATERAL — el nombre de la sección cuando el sidebar está colapsado.

   POR QUÉ VA POR PORTAL Y NO DENTRO DEL ITEM
   .sidebar tiene `overflow: hidden` (lo necesita: redondea las esquinas y
   recorta el nav que scrollea). Un globo posicionado dentro del item quedaría
   recortado justo en el borde del panel, que es exactamente por donde tiene que
   salir. Con un portal a document.body sale del subárbol recortado.

   Y POR ESO ES position:fixed CON COORDENADAS MEDIDAS: fuera del sidebar no hay
   un ancestro posicionado del que colgar, así que la posición se calcula desde
   el rect del item en el momento de entrar el puntero. Se recalcula en cada
   hover en vez de guardarse: el nav scrollea y el item se mueve.

   z-index 1300 = el mismo que usa el overlay de importación de Repuestos, por
   encima del drawer móvil (1200) y del overlay (1100). Ver la escala en
   Layout.css.

   NO SE MUESTRA EXPANDIDO: ahí el nombre ya está escrito al lado del icono y el
   globo sería ruido. De eso se encarga `activo`.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Entrada corta y sin muelle. Un tooltip no tiene masa: aparece y ya. El muelle
   compartido es para elementos que se desplazan; aquí un rebote se leería como
   un parpadeo. */
const TRANSICION = { duration: 0.12, ease: 'easeOut' };

const GLOBO = 'pointer-events-none fixed z-[1300] whitespace-nowrap rounded-sm '
  + 'bg-surface-dark px-md py-xs text-caption font-semibold text-text-on-dark shadow-lg';

export default function TooltipLateral({ texto, activo = true, children }) {
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  const mostrar = useCallback(() => {
    if (!activo || !ref.current) return;
    /* Se mide el HIJO, no el envoltorio. El envoltorio lleva `display: contents`
       para no meter una caja extra en el flex del nav, y precisamente por eso no
       GENERA caja: su getBoundingClientRect() devuelve ceros. Midiendolo a el, el
       globo aparecia en (10, -13) -- pegado a la esquina superior izquierda de la
       ventana en vez de junto al icono. Se veia, tenia su color y su z-index, y
       estaba en el sitio equivocado. */
    const objetivo = ref.current.firstElementChild;
    if (!objetivo) return;
    const r = objetivo.getBoundingClientRect();
    // 10px de separación del borde derecho del item; centrado en vertical.
    setPos({ x: r.right + 10, y: r.top + r.height / 2 });
  }, [activo]);

  const ocultar = useCallback(() => setPos(null), []);

  return (
    <div
      ref={ref}
      className="contents"
      onMouseEnter={mostrar}
      onMouseLeave={ocultar}
      /* focus/blur además de mouse: con el sidebar colapsado, quien navega con
         teclado necesita saber en qué sección está igual que quien usa ratón. */
      onFocusCapture={mostrar}
      onBlurCapture={ocultar}
    >
      {children}
      {ReactDOM.createPortal(
        <AnimatePresence>
          {pos && (
            <Motion.span
              role="tooltip"
              className={GLOBO}
              style={{ left: pos.x, top: pos.y, translate: '0 -50%' }}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={TRANSICION}
            >
              {texto}
            </Motion.span>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
