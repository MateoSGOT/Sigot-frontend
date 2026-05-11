import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginThunk, clearError } from '../slices/authSlice.js';
import { authService } from '../services/authService.js';
import api from '../../../shared/services/api.js';
import { MdLock, MdEmail, MdVisibility, MdVisibilityOff, MdClose, MdSearch, MdBuild, MdAssignment, MdEventNote, MdFlashOn } from 'react-icons/md';
import './LoginPage.css';

// Claves de localStorage que usa el PortalPage
const PORTAL_KEY = 'sigot_portal_token';
const PORTAL_CLIENT_KEY = 'sigot_portal_cliente';

const FEATURES = [
  { icon: MdBuild, title: 'Gestión de taller', desc: 'Ordenes de trabajo, servicios y repuestos en un solo lugar.' },
  { icon: MdEventNote, title: 'Agenda inteligente', desc: 'Programa citas y genera órdenes automáticamente.' },
  { icon: MdAssignment, title: 'Control total', desc: 'Empleados, clientes, vehículos e inventario centralizado.' },
];

const DEMO_ACCOUNTS = [
  { label: 'Administrador', correo: 'admin@sigot.com', pwd: 'admin123', color: 'success' },
  { label: 'Empleado', correo: 'tecnico@sigot.com', pwd: 'tecnico123', color: 'info' },
  { label: 'Cliente', correo: 'cliente@sigot.com', pwd: 'cliente123', color: 'purple' },
];

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ Correo: '', Password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [clienteLoading, setClienteLoading] = useState(false);

  // Password recovery modal
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState(null); // true when email sent
  const [recoveryError, setRecoveryError] = useState('');

  useEffect(() => {
    return () => { dispatch(clearError()); };
  }, [dispatch]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) dispatch(clearError());
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.Correo || !form.Password) return;
    dispatch(loginThunk(form));
  };

  const openRecovery = () => {
    setShowRecovery(true);
    setRecoveryEmail('');
    setRecoveryResult(null);
    setRecoveryError('');
  };

  const closeRecovery = () => {
    setShowRecovery(false);
  };

  const handleRecovery = async (e) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;
    setRecoveryLoading(true);
    setRecoveryError('');
    setRecoveryResult(null);
    try {
      await authService.solicitarRecuperacion(recoveryEmail.trim());
      setRecoveryResult(true);
    } catch (err) {
      setRecoveryError(
        err?.response?.data?.message || 'Ocurrió un error. Intenta de nuevo.'
      );
    } finally {
      setRecoveryLoading(false);
    }
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
          <div className="login-left__logo">
            <span>S</span>
          </div>
          <h1 className="login-left__title">Bienvenido<br />de nuevo</h1>
          <p className="login-left__subtitle">Sistema de Gestión de Órdenes y Taller</p>

          <div className="login-left__cards">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="login-feature-card">
                <div className="login-feature-card__icon">
                  <Icon size={18} />
                </div>
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
                <MdLock size={16} />
                {error}
              </div>
            )}

            <div className="login-form__group">
              <label className="login-form__label">Correo electrónico</label>
              <div className="login-form__field">
                <MdEmail className="login-form__field-icon" size={18} />
                <input
                  type="email"
                  name="Correo"
                  className="login-form__input"
                  placeholder="correo@empresa.com"
                  value={form.Correo}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="login-form__group">
              <label className="login-form__label">Contraseña</label>
              <div className="login-form__field">
                <MdLock className="login-form__field-icon" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="Password"
                  className="login-form__input login-form__input--has-toggle"
                  placeholder="••••••••"
                  value={form.Password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-form__toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-form__submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="login-form__spinner" />
                  Iniciando sesión...
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          {/* Demo quick access */}
          <div className="login-demo-section">
            <div className="login-demo-title">
              <MdFlashOn size={14} />
              Acceso rápido demo
            </div>
            <div className="login-demo-grid">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.correo}
                  type="button"
                  className={`login-demo-btn login-demo-btn--${acc.color}`}
                  disabled={clienteLoading}
                  onClick={async () => {
                    if (acc.color === 'purple') {
                      // Clientes van al portal usando su propio endpoint
                      setClienteLoading(true);
                      try {
                        const res = await api.post('/api/auth/cliente-login', { Correo: acc.correo });
                        const { token, cliente } = res.data?.data || {};
                        localStorage.setItem(PORTAL_KEY, token);
                        localStorage.setItem(PORTAL_CLIENT_KEY, JSON.stringify(cliente));
                        navigate('/portal');
                      } catch {
                        navigate('/portal');
                      } finally {
                        setClienteLoading(false);
                      }
                    } else {
                      if (error) dispatch(clearError());
                      dispatch(loginThunk({ Correo: acc.correo, Password: acc.pwd }));
                    }
                  }}
                >
                  <span className="login-demo-btn__label">
                    {acc.color === 'purple' && clienteLoading ? 'Ingresando...' : acc.label}
                  </span>
                  <span className="login-demo-btn__cred">{acc.correo}</span>
                </button>
              ))}
            </div>
          </div>

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
          <div className="login-modal" onClick={(e) => e.stopPropagation()}>
            <div className="login-modal__header">
              <h3 className="login-modal__title">Recuperar contraseña</h3>
              <button className="login-modal__close" onClick={closeRecovery}>
                <MdClose size={18} />
              </button>
            </div>

            <div className="login-modal__body">
              <p className="login-modal__desc">
                Ingresa el correo registrado para consultar tu contraseña.
              </p>

              <form className="login-recovery-form" onSubmit={handleRecovery}>
                <div className="login-form__group">
                  <label className="login-form__label" style={{ color: '#374151' }}>Correo electrónico</label>
                  <div className="login-form__field login-form__field--light">
                    <MdEmail className="login-form__field-icon login-form__field-icon--light" size={18} />
                    <input
                      type="email"
                      className="login-form__input login-form__input--light"
                      placeholder="correo@empresa.com"
                      value={recoveryEmail}
                      onChange={(e) => { setRecoveryEmail(e.target.value); setRecoveryError(''); setRecoveryResult(null); }}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="login-recovery-form__btn" disabled={recoveryLoading}>
                  {recoveryLoading ? (
                    <><span className="login-form__spinner login-form__spinner--green" />Buscando...</>
                  ) : (
                    <><MdSearch size={18} />Buscar</>
                  )}
                </button>
              </form>

              {recoveryError && (
                <div className="login-recovery__error">
                  {recoveryError}
                </div>
              )}

              {recoveryResult && (
                <div className="login-recovery__result">
                  <p className="login-recovery__result-label">
                    Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
