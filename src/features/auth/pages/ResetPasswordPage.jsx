import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { MdLock, MdVisibility, MdVisibilityOff, MdCheckCircle, MdArrowBack, MdWarning } from 'react-icons/md';
import api from '../../../shared/services/api.js';
import './ResetPasswordPage.css';

const getPasswordStrength = (pass) => {
  if (pass.length === 0) return null;
  if (pass.length < 6) return { level: 'weak',   label: 'Muy débil', color: '#ef4444', width: '25%' };
  if (pass.length < 8) return { level: 'fair',   label: 'Débil',     color: '#f59e0b', width: '50%' };
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
  const hasNumber  = /\d/.test(pass);
  const hasUpper   = /[A-Z]/.test(pass);
  if (hasSpecial && hasNumber && hasUpper && pass.length >= 10)
    return { level: 'strong', label: 'Fuerte', color: '#16a34a', width: '100%' };
  if ((hasNumber || hasSpecial) && pass.length >= 8)
    return { level: 'medium', label: 'Media',  color: '#3b82f6', width: '75%' };
  return { level: 'fair', label: 'Débil', color: '#f59e0b', width: '50%' };
};

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const token          = searchParams.get('token');

  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmar,     setConfirmar]     = useState('');
  const [showPass1,     setShowPass1]     = useState(false);
  const [showPass2,     setShowPass2]     = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [success,       setSuccess]       = useState(false);
  const [error,         setError]         = useState('');
  const [countdown,     setCountdown]     = useState(3);

  useEffect(() => {
    if (!success) return;
    const t = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(t); navigate('/login'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [success, navigate]);

  const strength = getPasswordStrength(nuevaPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (nuevaPassword.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (nuevaPassword !== confirmar) { setError('Las contraseñas no coinciden.'); return; }
    if (!token) { setError('Enlace inválido. Solicita uno nuevo desde el login.'); return; }

    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, nuevaPassword });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al actualizar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Token ausente ── */
  if (!token) {
    return (
      <div className="rsp-page">
        <div className="rsp-card">
          <div className="rsp-card__logo">
            <div className="rsp-logo-icon">S</div>
            <span className="rsp-logo-text">SIGOT</span>
          </div>
          <div className="rsp-error-state">
            <div className="rsp-error-icon"><MdWarning size={48} /></div>
            <h2 className="rsp-error-title">Enlace inválido</h2>
            <p className="rsp-error-desc">
              Este enlace de recuperación no es válido o ya expiró.
              Solicita uno nuevo desde el login.
            </p>
            <Link to="/login" className="rsp-btn rsp-btn--primary">
              <MdArrowBack size={16} />Volver al login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Success state ── */
  if (success) {
    return (
      <div className="rsp-page">
        <div className="rsp-card">
          <div className="rsp-card__logo">
            <div className="rsp-logo-icon">S</div>
            <span className="rsp-logo-text">SIGOT</span>
          </div>
          <div className="rsp-success-state">
            <div className="rsp-success-icon">
              <MdCheckCircle size={48} color="#16a34a" />
            </div>
            <h2 className="rsp-success-title">¡Contraseña actualizada!</h2>
            <p className="rsp-success-desc">
              Ya puedes iniciar sesión con tu nueva contraseña.
            </p>
            <p className="rsp-success-countdown">
              Redirigiendo en {countdown}...
            </p>
            <Link to="/login" className="rsp-btn rsp-btn--primary">
              Ir al login ahora
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <div className="rsp-page">
      <div className="rsp-card">
        <div className="rsp-card__logo">
          <div className="rsp-logo-icon">S</div>
          <span className="rsp-logo-text">SIGOT</span>
        </div>

        <div className="rsp-card__header">
          <h2 className="rsp-card__title">Nueva contraseña</h2>
          <p className="rsp-card__subtitle">Crea una contraseña segura para tu cuenta</p>
        </div>

        <form className="rsp-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="rsp-error-box">{error}</div>}

          {/* Nueva contraseña */}
          <div className="rsp-form__group">
            <label className="rsp-form__label">Nueva contraseña</label>
            <div className="rsp-form__field">
              <MdLock className="rsp-form__icon" size={18} />
              <input
                type={showPass1 ? 'text' : 'password'}
                className="rsp-form__input rsp-form__input--has-toggle"
                value={nuevaPassword}
                onChange={e => setNuevaPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoFocus
                required
              />
              <button type="button" className="rsp-form__toggle"
                onClick={() => setShowPass1(p => !p)} tabIndex={-1}>
                {showPass1 ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
              </button>
            </div>

            {/* Strength indicator */}
            {strength && (
              <div className="rsp-strength">
                <div className="rsp-strength__bar">
                  <div
                    className="rsp-strength__fill"
                    style={{ width: strength.width, background: strength.color }}
                  />
                </div>
                <span className="rsp-strength__label" style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          {/* Confirmar contraseña */}
          <div className="rsp-form__group">
            <label className="rsp-form__label">Confirmar contraseña</label>
            <div className="rsp-form__field">
              <MdLock className="rsp-form__icon" size={18} />
              <input
                type={showPass2 ? 'text' : 'password'}
                className="rsp-form__input rsp-form__input--has-toggle"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                placeholder="Repite la contraseña"
                required
              />
              <button type="button" className="rsp-form__toggle"
                onClick={() => setShowPass2(p => !p)} tabIndex={-1}>
                {showPass2 ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="rsp-btn rsp-btn--primary rsp-btn--full" disabled={loading}>
            {loading ? <><span className="rsp-spinner" />Actualizando...</> : 'Actualizar contraseña'}
          </button>
        </form>

        <div className="rsp-back">
          <Link to="/login" className="rsp-back-link">
            <MdArrowBack size={14} />Volver al login
          </Link>
        </div>
      </div>
    </div>
  );
}
