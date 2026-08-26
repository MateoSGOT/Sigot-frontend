import React, { useEffect, useState } from 'react';
import { MdSwapHoriz, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import { clientesService } from '../services/clientesService.js';

// Convierte un Cliente en Empleado (superadmin): borra el cliente en cascada y crea el
// empleado con los mismos datos de identidad (ver POST /api/clientes/:id/convertir-a-empleado).
// Exige texto de confirmación EXACTO "CONVERTIR <Nombre>", mismo patrón que EliminarRealModal.
export default function ConvertirAEmpleadoModal({ isOpen, onClose, cliente, roles = [], onSuccess }) {
  const [idRol, setIdRol] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) { setIdRol(''); setPassword(''); setShowPassword(false); setTexto(''); setError(''); setLoading(false); }
  }, [isOpen, cliente?.Id_Cliente]);

  const rolesOpts = roles.map(r => ({ value: String(r.Id_Rol), label: r.Nombre }));
  const esperado = cliente?.Nombre ? `CONVERTIR ${cliente.Nombre}` : '';
  const textoOk = texto.trim() === esperado && esperado.length > 0;
  const puedeEnviar = textoOk && !!idRol && password.trim().length >= 6 && !loading;

  const handleConfirm = async () => {
    if (!puedeEnviar || !cliente) return;
    setLoading(true);
    setError('');
    try {
      const resp = await clientesService.convertirAEmpleado(cliente.Id_Cliente, {
        Id_Rol: Number(idRol),
        Password: password.trim(),
        confirmacion: texto.trim(),
      });
      onSuccess?.(resp?.data || resp);
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo convertir el cliente en empleado.');
      setLoading(false);
    }
  };

  const footer = (
    <>
      <button className="btn btn--outline" onClick={onClose} disabled={loading}>Cancelar</button>
      <button className="btn btn--danger" disabled={!puedeEnviar} onClick={handleConfirm}>
        <MdSwapHoriz size={17} /> {loading ? 'Convirtiendo…' : 'Convertir en empleado'}
      </button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Convertir cliente en empleado" size="sm" footer={footer}>
      {!cliente?.Correo ? (
        <div className="del-modal__block">
          <div className="del-modal__block-head">No se puede convertir</div>
          <p className="del-modal__hint" style={{ margin: 0 }}>
            El cliente necesita un correo registrado antes de poder convertirse en empleado.
            Agrégale un correo y guarda los cambios primero.
          </p>
        </div>
      ) : (
        <>
          <p className="del-modal__lead">
            Vas a eliminar a <strong>{cliente.Nombre}</strong> como cliente (con su historial de
            vehículos y citas) y crear una cuenta de empleado con sus mismos datos. Esta acción no
            se puede deshacer.
          </p>

          <div className="form-group">
            <label className="form-label">Rol del nuevo empleado <span className="required">*</span></label>
            <SearchableSelect
              options={rolesOpts}
              value={idRol}
              onChange={setIdRol}
              placeholder="Seleccionar rol..."
            />
          </div>

          <div className="form-group" style={{ marginTop: '0.75rem' }}>
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

          {error && <div className="form-error-box" style={{ marginTop: '0.75rem' }}>{error}</div>}
        </>
      )}
    </Modal>
  );
}
