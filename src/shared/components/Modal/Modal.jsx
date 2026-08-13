import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { MdClose } from 'react-icons/md';
import './Modal.css';

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

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    // El click en el overlay ya no cierra el modal: evita perder datos del formulario
    // por un click accidental fuera del cuadro. Cerrar requiere el botón X o "Cancelar".
    <div className="modal-overlay">
      <div className={`modal modal--${size}`} onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button className="modal__close" onClick={onClose} title="Cerrar">
            <MdClose size={20} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
