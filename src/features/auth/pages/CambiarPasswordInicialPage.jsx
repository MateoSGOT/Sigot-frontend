import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService.js';
import { passwordChanged, logout } from '../slices/authSlice.js';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import './LoginPage.css';

const RULES = {
  passwordActual: (v) => (V.isBlank(v) ? 'Ingresa tu contraseña actual.' : ''),
  // La nueva debe ser fuerte y distinta a la actual (no repetir la temporal).
  passwordNueva:  (v, all) => V.passwordFuerte(v) || (v && v === all.passwordActual ? 'La nueva contraseña no puede ser igual a la actual.' : ''),
  confirmar:      (v, all) => V.confirmarPassword(v, all.passwordNueva),
};

export default function CambiarPasswordInicialPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { tipo } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ passwordActual: '', passwordNueva: '', confirmar: '' });
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const { errors, touched, setErrors, revalidate, markTouched, touchAll, fieldError, isInvalid, validateNow } = useFormValidation(RULES);

  const handleChange = (e) => {
    const next = { ...form, [e.target.name]: e.target.value };
    setForm(next);
    if (touched[e.target.name] || errors[e.target.name]) revalidate(next);
  };
  const handleBlur = (e) => { markTouched(e.target.name); revalidate(form); };

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
    <div className="login-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="login-form-wrap" style={{ maxWidth: 440, width: '100%' }}>
        <div className="login-form-header">
          <h1 className="login-form-header__title">Cambia tu contraseña</h1>
          <p className="login-form-header__subtitle">Por seguridad, debes cambiar la contraseña temporal antes de continuar.</p>
        </div>

        {formError && <div className="login-form__error">{formError}</div>}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Contraseña actual (temporal) <span className="required">*</span></label>
            <input name="passwordActual" type="password" className={`form-control ${fieldError('passwordActual') ? 'is-error' : ''}`}
              value={form.passwordActual} onChange={handleChange} onBlur={handleBlur} placeholder="La contraseña que recibiste por correo" />
            {fieldError('passwordActual') && <p className="form-error">{fieldError('passwordActual')}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Nueva contraseña <span className="required">*</span></label>
            <input name="passwordNueva" type="password" className={`form-control ${fieldError('passwordNueva') ? 'is-error' : ''}`}
              value={form.passwordNueva} onChange={handleChange} onBlur={handleBlur} placeholder="Mínimo 8, con letra y número" />
            {fieldError('passwordNueva') && <p className="form-error">{fieldError('passwordNueva')}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Confirmar nueva contraseña <span className="required">*</span></label>
            <input name="confirmar" type="password" className={`form-control ${fieldError('confirmar') ? 'is-error' : ''}`}
              value={form.confirmar} onChange={handleChange} onBlur={handleBlur} placeholder="Repite la nueva contraseña" />
            {fieldError('confirmar') && <p className="form-error">{fieldError('confirmar')}</p>}
          </div>
          <button type="submit" className="btn btn--primary" style={{ width: '100%' }} disabled={loading || isInvalid(form)}>
            {loading ? 'Guardando...' : 'Cambiar contraseña y continuar'}
          </button>
        </form>

        <button className="btn btn--ghost" style={{ marginTop: '1rem', width: '100%' }} onClick={() => { dispatch(logout()); window.location.replace('/'); }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
