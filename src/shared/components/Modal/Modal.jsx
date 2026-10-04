import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
// Se importa como `Motion` (mayuscula) y no como `motion`: la config de eslint
// del proyecto exime de no-unused-vars solo lo que empieza en mayuscula
// (varsIgnorePattern '^[A-Z_]'), porque no tiene eslint-plugin-react y la regla
// no reconoce el JSX con miembro (<Motion.div>) como un uso de la variable.
import { motion as Motion, AnimatePresence } from 'motion/react';
import { MdClose } from 'react-icons/md';
import './Modal.css';

/* Transición física del modal. Un spring en vez de una curva de duración fija:
   el cuadro desacelera por masa, no por reloj, que es lo que hace que se lea
   como una app nativa y no como una transición CSS.

   stiffness/damping altos = entra rápido y se asienta sin rebote. Un modal que
   rebota sobre un formulario de datos se siente juguetón, no fluido.

   Solo se animan `opacity`, `scale` y `y`: las tres las resuelve el compositor
   sin repintar. Deliberadamente NO se anima la altura ni el backdrop-filter --
   el blur del velo es de por sí caro y animarlo tira los fotogramas en móvil. */
const RESORTE = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 };

export default function Modal({ isOpen, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  /* AnimatePresence tiene que montarse SIEMPRE, también con isOpen=false: es lo
     que le permite animar la SALIDA. El `if (!isOpen) return null` de antes
     desmontaba el árbol de golpe, así que el modal aparecía con transición y
     desaparecía de un corte. Los dos efectos de arriba siguen antes de este
     punto, con las mismas dependencias, para no cambiar su comportamiento. */
  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        // El click en el overlay ya no cierra el modal: evita perder datos del
        // formulario por un click accidental fuera del cuadro. Cerrar requiere
        // el botón X o "Cancelar".
        <Motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <Motion.div
            className={`modal modal--${size}`}
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={RESORTE}
          >
            <div className="modal__header">
              <h2 className="modal__title">{title}</h2>
              <button className="modal__close" onClick={onClose} title="Cerrar">
                <MdClose size={20} />
              </button>
            </div>
            <div className="modal__body">{children}</div>
            {footer && <div className="modal__footer">{footer}</div>}
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
