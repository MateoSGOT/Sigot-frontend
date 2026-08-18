import React, { useState, useEffect } from 'react';
import { MdWarningAmber, MdBlock, MdDeleteForever } from 'react-icons/md';
import Modal from '../Modal/Modal.jsx';
import './EliminarRealModal.css';

// Modal reutilizable de BORRADO REAL (distinto del toggle de estado).
// Muestra la vista previa de dependencias que devuelve el backend:
//   - bloqueado  → panel de bloqueo + lista de lo que lo impide (sin opción de forzar).
//   - con cascada sin historial → resumen + confirmación por TEXTO EXACTO.
// Props:
//   entidadLabel      p. ej. "categoría"
//   preview           data de GET /:id/dependencias  { nombre, textoConfirmacion, cascada[], bloqueantes[], bloqueado }
//   loadingPreview    cargando la vista previa
//   deleting          ejecutando el DELETE
//   error             mensaje de error del DELETE
//   onConfirm(texto)  callback al confirmar
export default function EliminarRealModal({
  isOpen,
  onClose,
  entidadLabel = 'registro',
  preview,
  loadingPreview,
  deleting,
  error,
  onConfirm,
}) {
  const [texto, setTexto] = useState('');

  // Reinicia el texto al abrir o al cambiar de registro.
  useEffect(() => { setTexto(''); }, [isOpen, preview?.id]);

  const bloqueado = !!preview?.bloqueado;
  const esperado = preview?.textoConfirmacion || '';
  const textoOk = texto.trim() === esperado && esperado.length > 0;
  const cascadaVisible = (preview?.cascada || []).filter((c) => c.cantidad > 0);

  let footer = null;
  if (!loadingPreview && preview) {
    footer = bloqueado ? (
      <button className="btn btn--outline" onClick={onClose}>Entendido</button>
    ) : (
      <>
        <button className="btn btn--outline" onClick={onClose} disabled={deleting}>Cancelar</button>
        <button
          className="btn btn--danger"
          disabled={!textoOk || deleting}
          onClick={() => onConfirm(texto.trim())}
        >
          <MdDeleteForever size={17} /> {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
        </button>
      </>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Eliminar ${entidadLabel}`} size="sm" footer={footer}>
      {loadingPreview && <p className="del-modal__loading">Analizando dependencias…</p>}

      {!loadingPreview && preview && (
        <>
          {bloqueado ? (
            <div className="del-modal__block">
              <div className="del-modal__block-head"><MdBlock size={18} /> No se puede eliminar</div>
              <ul className="del-modal__list">
                {preview.bloqueantes.map((b, i) => (
                  <li key={i}>{b.motivo || `${b.cantidad ?? ''} en ${b.tabla}`}</li>
                ))}
              </ul>
              <p className="del-modal__hint">
                Debe conservarse por su historial. Resuelve lo anterior e inténtalo de nuevo.
              </p>
            </div>
          ) : (
            <>
              <p className="del-modal__lead">
                Vas a eliminar <strong>{preview.nombre}</strong> de forma permanente. Esta acción no se puede deshacer.
              </p>

              {cascadaVisible.length > 0 && (
                <div className="del-modal__cascade">
                  <div className="del-modal__cascade-head">
                    <MdWarningAmber size={17} /> También se eliminará en cascada:
                  </div>
                  <ul className="del-modal__list">
                    {cascadaVisible.map((c, i) => (
                      <li key={i}><strong>{c.cantidad}</strong> · {c.tabla}</li>
                    ))}
                  </ul>
                </div>
              )}

              <label className="form-label del-modal__confirm-label">
                Para confirmar, escribe: <code>{esperado}</code>
              </label>
              <input
                className="form-control"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={esperado}
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
            </>
          )}

          {error && <div className="form-error-box" style={{ marginTop: '0.75rem' }}>{error}</div>}
        </>
      )}
    </Modal>
  );
}
