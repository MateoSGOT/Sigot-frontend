import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { MdLock, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { authService } from '../services/authService.js';
import { passwordChanged, logout } from '../slices/authSlice.js';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';

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

/* ═══════════════════════════════════════════════════════════════════════════
   Clases de la vista, en utilidades. CambiarPasswordInicialPage.css eliminado.

   OJO: esta pantalla va sobre fondo CLARO (--color-bg), a diferencia de
   /reset-password, que es la unica sobre superficie oscura. Por eso aqui se
   reusan los mismos patrones que el Login y NO las opacidades blancas.

   Su CSS tenia dos partes: cuatro clases propias .cpi-* y un subconjunto de
   ~6.5 kB heredado de LoginPage.css, que se habia copiado ahi cuando el Login
   se migro a Tailwind. Al migrar esta pagina, ese subconjunto desaparece
   tambien: era su unico consumidor.
   ═══════════════════════════════════════════════════════════════════════════ */
const CPI_CAMPO = 'w-full rounded-sm border border-border bg-input-bg py-md pl-[2.75rem] pr-[2.75rem] '
  + 'text-body text-text placeholder:text-text-disabled outline-none '
  + 'transition-[border-color,box-shadow] duration-150 '
  + 'focus-visible:border-focus focus-visible:shadow-[0_0_0_3px_var(--color-focus-ring)]';

const CPI_BOTON = 'inline-flex w-full items-center justify-center gap-sm rounded-md border-0 '
  + 'bg-primary px-xl text-body font-semibold text-primary-on min-h-[var(--touch-min)] '
  + 'cursor-pointer transition-[background-color,box-shadow,transform] duration-150 '
  + 'hover:bg-primary-strong hover:shadow-[var(--shadow-green)] active:scale-[0.99] '
  + 'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-primary disabled:hover:shadow-none '
  + 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

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
    <div className="flex min-h-dvh items-center justify-center bg-bg px-lg py-2xl">
      <div className="w-full max-w-[27.5rem] rounded-lg border border-border bg-surface p-2xl shadow-md">
        <div className="mb-xl flex flex-col">
          <h1 className="font-display text-h1 font-extrabold tracking-tight text-text">Cambia tu contraseña</h1>
          <p className="mt-xs text-body leading-normal text-text-muted">Por seguridad, debes cambiar la contraseña temporal antes de continuar.</p>
        </div>

        {formError && (
          <div className="mb-lg flex items-center gap-sm rounded-md bg-danger-soft px-lg py-md text-small font-medium text-danger-soft-on">
            <MdLock size={16} />{formError}
          </div>
        )}

        <form className="flex flex-col gap-lg" onSubmit={handleSubmit} noValidate>
          {CAMPOS.map(({ name, label, placeholder }) => (
            <div className="flex flex-col gap-sm" key={name}>
              <label className="block text-caption font-semibold uppercase tracking-wide text-text-light">{label} <span className="required">*</span></label>
              <div className={`relative${fieldError(name) ? ' [&_input]:border-danger' : ''}`}>
                <MdLock className="pointer-events-none absolute left-lg top-1/2 -translate-y-1/2 text-text-light" size={18} />
                <input
                  name={name}
                  type={visible[name] ? 'text' : 'password'}
                  className={CPI_CAMPO}
                  placeholder={placeholder}
                  value={form[name]}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete={name === 'passwordActual' ? 'current-password' : 'new-password'}
                />
                <button type="button" className="absolute right-sm top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-sm border-0 bg-transparent text-text-light cursor-pointer transition-colors duration-150 hover:text-text" onClick={() => toggleVisible(name)} tabIndex={-1}>
                  {visible[name] ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                </button>
              </div>
              {fieldError(name) && <p className="text-caption font-medium text-danger-soft-on">{fieldError(name)}</p>}
            </div>
          ))}

          <button type="submit" className={CPI_BOTON} disabled={loading || isInvalid(form)}>
            {loading ? <><span className="size-4 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current" />Guardando...</> : 'Cambiar contraseña y continuar'}
          </button>
        </form>

        <button className="btn btn--ghost mt-lg w-full" onClick={() => { dispatch(logout()); window.location.replace('/login'); }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
