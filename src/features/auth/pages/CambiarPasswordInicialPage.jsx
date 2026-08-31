import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { MdLock, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { authService } from '../services/authService.js';
import { passwordChanged, logout } from '../slices/authSlice.js';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import './LoginPage.css';
import './CambiarPasswordInicialPage.css';

const RULES = {
  passwordActual: (v) => (V.isBlank(v) ? 'Ingresa tu contraseña actual.' : ''),
  // La nueva debe ser fuerte y distinta a la actual (no repetir la temporal).
  passwordNueva:  (v, all) => V.passwordFuerte(v) || (v && v === all.passwordActual ? 'La nueva contraseña no puede ser igual a la actual.' : ''),
  confirmar:      (v, all) => V.confirmarPassword(v, all.passwordNueva),
};

const CAMPOS = [
  { name: 'passwordActual', label: 'Contraseña actual (temporal)', placeholder: 'La contraseña que recibiste por correo' },
  { name: 'passwordNueva',  label: 'Nueva contraseña',             placeholder: 'Mínimo 8, con letra y número' },
  { name: 'confirmar',      label: 'Confirmar nueva contraseña',   placeholder: 'Repite la nueva contraseña' },
];

export default function CambiarPasswordInicialPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { tipo } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ passwordActual: '', passwordNueva: '', confirmar: '' });
  const [visible, setVisible] = useState({ passwordActual: false, passwordNueva: false, confirmar: false });
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const { errors, touched, setErrors, revalidate, markTouched, touchAll, fieldError, isInvalid, validateNow } = useFormValidation(RULES);

  const handleChange = (e) => {
    const next = { ...form, [e.target.name]: e.target.value };
    setForm(next);
    if (touched[e.target.name] || errors[e.target.name]) revalidate(next);
  };
  const handleBlur = (e) => { markTouched(e.target.name); revalidate(form); };
  const toggleVisible = (name) => setVisible((v) => ({ ...v, [name]: !v[name] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateNow(form);
    setErrors(errs); touchAll();
    if (V.hasErrors(errs)) { setFormError('Corrige los campos marcados.'); return; }
    setFormError(''); setLoading(true);
    try {
      await authService.cambiarPasswordInicial(form.passwordActual, form.passwordNueva);
      dispatch(passwordChanged());
      navigate(tipo === 'cliente' ? '/portal' : '/dashboard', { replace: true });
    } catch (err) {
      setFormError(err?.response?.data?.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cpi-page">
      <div className="login-form-wrap cpi-card">
        <div className="login-form-header">
          <h1 className="login-form-header__title">Cambia tu contraseña</h1>
          <p className="login-form-header__subtitle">Por seguridad, debes cambiar la contraseña temporal antes de continuar.</p>
        </div>

        {formError && (
          <div className="login-form__error">
            <MdLock size={16} />{formError}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {CAMPOS.map(({ name, label, placeholder }) => (
            <div className="login-form__group" key={name}>
              <label className="login-form__label">{label} <span className="required">*</span></label>
              <div className={`login-form__field${fieldError(name) ? ' login-form__field--error' : ''}`}>
                <MdLock className="login-form__field-icon" size={18} />
                <input
                  name={name}
                  type={visible[name] ? 'text' : 'password'}
                  className="login-form__input login-form__input--has-toggle"
                  placeholder={placeholder}
                  value={form[name]}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete={name === 'passwordActual' ? 'current-password' : 'new-password'}
                />
                <button type="button" className="login-form__toggle" onClick={() => toggleVisible(name)} tabIndex={-1}>
                  {visible[name] ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                </button>
              </div>
              {fieldError(name) && <p className="cpi-field-error">{fieldError(name)}</p>}
            </div>
          ))}

          <button type="submit" className="login-form__submit" disabled={loading || isInvalid(form)}>
            {loading ? <><span className="login-form__spinner" />Guardando...</> : 'Cambiar contraseña y continuar'}
          </button>
        </form>

        <button className="btn btn--ghost cpi-logout" onClick={() => { dispatch(logout()); window.location.replace('/login'); }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
