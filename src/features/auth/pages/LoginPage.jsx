import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginThunk, clearError } from '../slices/authSlice.js';
import { authService } from '../services/authService.js';
import { MdLock, MdEmail, MdVisibility, MdVisibilityOff, MdClose, MdBuild, MdAssignment, MdEventNote, MdSend } from 'react-icons/md';
import './LoginPage.css';

const FEATURES = [
  { icon: MdBuild,      title: 'Gestión de taller',  desc: 'Ordenes de trabajo, servicios y repuestos en un solo lugar.' },
  { icon: MdEventNote,  title: 'Agenda inteligente', desc: 'Programa citas y genera órdenes automáticamente.' },
  { icon: MdAssignment, title: 'Control total',       desc: 'Empleados, clientes, vehículos e inventario centralizado.' },
];

const RESEND_COOLDOWN = 60;

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, tipo } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ Correo: '', Password: '' });
  const [showPassword, setShowPassword] = useState(false);

  // Recovery modal state
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1); // 1 = form, 2 = confirmation
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef(null);

  useEffect(() => {
    return () => {
      dispatch(clearError());
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [dispatch]);

  const startCountdown = () => {
    setResendCountdown(RESEND_COOLDOWN);
    countdownRef.current = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) dispatch(clearError());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.Correo || !form.Password) return;
    const result = await dispatch(loginThunk(form));
    if (!result.error) {
      const payload = result.payload?.data || result.payload;
      if (payload?.tipo === 'cliente') {
        navigate('/portal');
      } else {
        navigate('/dashboard');
      }
    }
  };

  const openRecovery = () => {
    setShowRecovery(true);
    setRecoveryStep(1);
    setRecoveryEmail('');
    setRecoveryError('');
    setResendCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const closeRecovery = () => {
    setShowRecovery(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const sendRecovery = async (email) => {
    setRecoveryLoading(true);
    setRecoveryError('');
    try {
      await authService.solicitarRecuperacion(email.trim());
      setRecoveryStep(2);
      startCountdown();
    } catch (err) {
      setRecoveryError(err?.response?.data?.message || 'Ocurrió un error. Intenta de nuevo.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleRecoverySubmit = (e) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;
    sendRecovery(recoveryEmail);
  };

  const handleResend = () => {
    if (resendCountdown > 0) return;
    sendRecovery(recoveryEmail);
  };

  return (
    <div className="login-page">
      {/* ── Left: Decorative ── */}
      <div className="login-left">
        <div className="login-left__blobs">
          <div className="login-left__blob login-left__blob--1" />
          <div className="login-left__blob login-left__blob--2" />
          <div className="login-left__blob login-left__blob--3" />
        </div>

        <div className="login-left__content">
          <div className="login-left__logo"><span>S</span></div>
          <h1 className="login-left__title">Bienvenido<br />de nuevo</h1>
          <p className="login-left__subtitle">Sistema de Gestión de Órdenes y Taller</p>

          <div className="login-left__cards">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="login-feature-card">
                <div className="login-feature-card__icon"><Icon size={18} /></div>
                <div>
                  <p className="login-feature-card__title">{title}</p>
                  <p className="login-feature-card__desc">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Form ── */}
      <div className="login-right">
        <div className="login-form-wrap">
          <div className="login-form-header">
            <h2 className="login-form-header__title">Iniciar Sesión</h2>
            <p className="login-form-header__subtitle">Ingresa tus credenciales para continuar</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="login-form__error">
                <MdLock size={16} />{error}
              </div>
            )}

            <div className="login-form__group">
              <label className="login-form__label">Correo electrónico</label>
              <div className="login-form__field">
                <MdEmail className="login-form__field-icon" size={18} />
                <input
                  type="email" name="Correo" className="login-form__input"
                  placeholder="correo@empresa.com" value={form.Correo}
                  onChange={handleChange} autoComplete="email" required
                />
              </div>
            </div>

            <div className="login-form__group">
              <label className="login-form__label">Contraseña</label>
              <div className="login-form__field">
                <MdLock className="login-form__field-icon" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'} name="Password"
                  className="login-form__input login-form__input--has-toggle"
                  placeholder="••••••••" value={form.Password}
                  onChange={handleChange} autoComplete="current-password" required
                />
                <button type="button" className="login-form__toggle"
                  onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-form__submit" disabled={loading}>
              {loading ? <><span className="login-form__spinner" />Iniciando sesión...</> : 'Ingresar'}
            </button>
          </form>

          <div className="login-form-links">
            <button className="login-recovery-link" onClick={openRecovery}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </div>
      </div>

      {/* ── Recovery Modal ── */}
      {showRecovery && (
        <div className="login-modal-overlay" onClick={closeRecovery}>
          <div className="login-modal" onClick={e => e.stopPropagation()}>
            <div className="login-modal__header">
              <h3 className="login-modal__title">
                {recoveryStep === 1 ? '¿Olvidaste tu contraseña?' : 'Revisa tu correo'}
              </h3>
              <button className="login-modal__close" onClick={closeRecovery}>
                <MdClose size={18} />
              </button>
            </div>

            <div className="login-modal__body">
              {recoveryStep === 1 ? (
                <>
                  <p className="login-modal__desc">
                    Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.
                  </p>

                  <form className="login-recovery-form" onSubmit={handleRecoverySubmit}>
                    <div className="login-form__group">
                      <label className="login-form__label" style={{ color: '#374151' }}>
                        Correo electrónico
                      </label>
                      <div className="login-form__field login-form__field--light">
                        <MdEmail className="login-form__field-icon login-form__field-icon--light" size={18} />
                        <input
                          type="email"
                          className="login-form__input login-form__input--light"
                          placeholder="correo@empresa.com"
                          value={recoveryEmail}
                          onChange={e => { setRecoveryEmail(e.target.value); setRecoveryError(''); }}
                          autoFocus
                          required
                        />
                      </div>
                    </div>

                    {recoveryError && (
                      <div className="login-recovery__error">{recoveryError}</div>
                    )}

                    <button type="submit" className="login-recovery-form__btn" disabled={recoveryLoading}>
                      {recoveryLoading
                        ? <><span className="login-form__spinner login-form__spinner--green" />Enviando...</>
                        : <><MdSend size={16} />Enviar enlace de recuperación</>
                      }
                    </button>
                  </form>
                </>
              ) : (
                <div className="login-recovery__confirm">
                  <div className="login-recovery__confirm-icon">📧</div>
                  <p className="login-recovery__confirm-title">Enlace enviado</p>
                  <p className="login-recovery__confirm-msg">
                    Si el correo <strong>{recoveryEmail}</strong> está registrado en SIGOT,
                    recibirás un enlace en los próximos minutos.
                    <br />El enlace expirará en <strong>15 minutos</strong>.
                  </p>
                  <p className="login-recovery__confirm-hint">
                    ¿No lo ves? Revisa tu carpeta de spam.
                  </p>

                  <div className="login-recovery__confirm-actions">
                    <button
                      type="button"
                      className="login-recovery__resend-btn"
                      onClick={handleResend}
                      disabled={resendCountdown > 0 || recoveryLoading}
                    >
                      {recoveryLoading
                        ? <><span className="login-form__spinner login-form__spinner--green" />Reenviando...</>
                        : resendCountdown > 0
                          ? `Reenviar en ${resendCountdown}s`
                          : 'Reenviar'
                      }
                    </button>
                    <button type="button" className="login-recovery-form__btn" onClick={closeRecovery}>
                      Entendido
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
