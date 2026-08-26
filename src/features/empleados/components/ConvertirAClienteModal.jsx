import React, { useEffect, useState } from 'react';
import { MdSwapHoriz, MdVisibility, MdVisibilityOff, MdBlock } from 'react-icons/md';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import { empleadosService } from '../services/empleadosService.js';

// Convierte un Empleado en Cliente (superadmin): igual estilo que
// ConvertirAEmpleadoModal (Clientes), pero primero pide la vista previa de
// GET /:id/dependencias (la MISMA que usa el borrado real de empleado) para avisar si
// tiene Órdenes de Trabajo u Novedades asignadas ANTES de dejar avanzar.
export default function ConvertirAClienteModal({ isOpen, onClose, empleado, onSuccess }) {
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !empleado) return;
    setPassword(''); setShowPassword(false); setTexto(''); setError(''); setLoading(false);
    setPreview(null); setLoadingPreview(true);
    empleadosService.getDependencias(empleado.Id_Empleado)
      .then(setPreview)
      .catch((e) => setError(e?.response?.data?.message || 'No se pudo revisar el empleado.'))
      .finally(() => setLoadingPreview(false));
  }, [isOpen, empleado?.Id_Empleado]);

  const nombre = empleado?.Nombre || preview?.nombre || '';
  const esperado = nombre ? `CONVERTIR ${nombre}` : '';
  const bloqueado = !!preview?.bloqueado;
  const textoOk = texto.trim() === esperado && esperado.length > 0;
  const puedeEnviar = !loadingPreview && !bloqueado && textoOk && password.trim().length >= 6 && !loading;

  const handleConfirm = async () => {
    if (!puedeEnviar || !empleado) return;
    setLoading(true);
    setError('');
    try {
      const resp = await empleadosService.convertirACliente(empleado.Id_Empleado, {
        Password: password.trim(),
        confirmacion: texto.trim(),
      });
      onSuccess?.(resp?.data || resp);
    } catch (e) {
      // Si el bloqueo cambió justo antes de confirmar (TOCTOU), el backend lo vuelve a
      // rechazar con 409 y detalle -- se muestra igual, aunque el modal ya no lo previó.
      setError(e?.response?.data?.message || 'No se pudo convertir el empleado en cliente.');
      setLoading(false);
    }
  };

  let footer = null;
  if (!loadingPreview) {
    footer = bloqueado ? (
      <button className="btn btn--outline" onClick={onClose}>Entendido</button>
    ) : (
      <>
        <button className="btn btn--outline" onClick={onClose} disabled={loading}>Cancelar</button>
        <button className="btn btn--danger" disabled={!puedeEnviar} onClick={handleConfirm}>
          <MdSwapHoriz size={17} /> {loading ? 'Convirtiendo…' : 'Convertir en cliente'}
        </button>
      </>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Convertir empleado en cliente" size="sm" footer={footer}>
      {loadingPreview && <p className="del-modal__loading">Revisando trabajo asignado…</p>}

      {!loadingPreview && bloqueado && (
        <div className="del-modal__block">
          <div className="del-modal__block-head"><MdBlock size={18} /> No se puede convertir</div>
          <ul className="del-modal__list">
            {preview.bloqueantes.map((b, i) => (
              <li key={i}>{b.motivo || `${b.cantidad ?? ''} en ${b.tabla}`}</li>
            ))}
          </ul>
          <p className="del-modal__hint">
            Este empleado tiene trabajo asignado (órdenes de trabajo y/o novedades). Resuelve
            o reasigna eso primero e inténtalo de nuevo.
          </p>
        </div>
      )}

      {!loadingPreview && !bloqueado && preview && (
        <>
          <p className="del-modal__lead">
            Vas a eliminar a <strong>{nombre}</strong> como empleado y crear una cuenta de
            cliente con sus mismos datos. Esta acción no se puede deshacer.
          </p>

          <div className="form-group">
            <label className="form-label">Contraseña inicial <span className="required">*</span></label>
            <div className="form-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
              <button type="button" className="form-password-toggle" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
              </button>
            </div>
            <p className="form-hint" style={{ marginTop: '0.25rem' }}>Se enviará por correo y deberá cambiarla en el primer ingreso.</p>
          </div>

          <label className="form-label del-modal__confirm-label" style={{ marginTop: '0.75rem' }}>
            Para confirmar, escribe: <code>{esperado}</code>
          </label>
          <input
            className="form-control"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={esperado}
            autoComplete="off"
            spellCheck={false}
          />
        </>
      )}

      {error && <div className="form-error-box" style={{ marginTop: '0.75rem' }}>{error}</div>}
    </Modal>
  );
}
