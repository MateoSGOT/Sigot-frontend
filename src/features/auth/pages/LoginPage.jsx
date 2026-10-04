import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
// Se importa como `Motion` (mayuscula) y no como `motion`: la config de eslint
// del proyecto exime de no-unused-vars solo lo que empieza en mayuscula
// (varsIgnorePattern '^[A-Z_]'), porque no tiene eslint-plugin-react y la regla
// no reconoce el JSX con miembro (<Motion.div>) como un uso de la variable.
import { motion as Motion, AnimatePresence } from 'motion/react';
import { loginThunk, clearError } from '../slices/authSlice.js';
import { authService } from '../services/authService.js';
import {
  MdLock, MdEmail, MdVisibility, MdVisibilityOff, MdClose,
  MdSend, MdLocationOn, MdArrowBack,
} from 'react-icons/md';
import { correo as validarCorreo } from '../../../shared/utils/validators.js';

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIN — reescrito con Tailwind v4 + Motion.

   SIN CSS PROPIO. LoginPage.css (17.6 kB) queda eliminado: todo sale de
   utilidades, y las utilidades resuelven a los MISMOS tokens que el resto de la
   app (ver shared/styles/tailwind-theme.css, generado desde variables.css). Por
   eso `bg-bg` es el mismo slate-50 del canvas y `rounded-lg` el mismo canto de
   24 px que usan las tarjetas escritas a mano.

   Era obligatorio soltar las clases viejas, no mezclarlas: el CSS del proyecto
   es no estratificado y le gana a la capa `utilities` de Tailwind. Una vista a
   medio migrar no habría aplicado ni una utilidad.

   CAMBIO DE CONTENIDO: el brief pide "tarjeta central minimalista", así que el
   panel decorativo izquierdo (wordmark grande + 4 tarjetas de features) ya no
   está. Se conserva el wordmark sobre la tarjeta para no perder la marca; las
   features son contenido de marketing y viven en la landing.

   LÓGICA INTACTA: mismo estado, mismos handlers, mismo thunk, mismas
   validaciones y el mismo contrato de navegación posterior al login.
   ═══════════════════════════════════════════════════════════════════════════ */

const RESEND_COOLDOWN = 60;

/* Transición física compartida. Un spring (no una curva de duración fija) es lo
   que hace que el movimiento se sienta nativo: la tarjeta desacelera por masa,
   no por reloj. `stiffness` alto y `damping` alto = rápido y sin rebote visible,
   que es lo que corresponde a una pantalla de acceso -- un login que rebota se
   lee como poco serio. */
const RESORTE = { type: 'spring', stiffness: 420, damping: 32, mass: 0.9 };

/* Clases repetidas, extraídas a constantes y no a @apply: con @apply volverían a
   ser CSS propio, que es justo lo que se está quitando. */
const CAMPO = 'w-full rounded-md border border-border bg-input-bg py-md pl-[2.75rem] pr-md '
  + 'text-body text-text placeholder:text-text-disabled outline-none '
  + 'transition-[border-color,box-shadow] duration-150 '
  + 'focus-visible:border-focus focus-visible:shadow-[0_0_0_3px_var(--color-focus-ring)]';

const ICONO_CAMPO = 'pointer-events-none absolute left-lg top-1/2 -translate-y-1/2 text-text-light';

const ETIQUETA = 'block text-caption font-semibold uppercase tracking-wide text-text-light';

const BOTON_PRIMARIO = 'inline-flex w-full items-center justify-center gap-sm rounded-md '
  + 'bg-primary px-xl text-body font-semibold text-primary-on '
  + 'min-h-[var(--touch-min)] cursor-pointer border-0 '
  + 'transition-[background-color,box-shadow,transform] duration-150 '
  + 'hover:bg-primary-strong hover:shadow-[var(--shadow-green)] active:scale-[0.99] '
  + 'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-primary disabled:hover:shadow-none '
  + 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 rounded-full border-2 border-current/30 border-t-current animate-spin"
    />
  );
}

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ Correo: '', Password: '' });
  const [showPassword, setShowPassword] = useState(false);

  // Recovery modal state
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1); // 1 = form, 2 = confirmation
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryTouched, setRecoveryTouched] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');

  // Validación de FORMATO en tiempo real (no revela si el correo existe:
  // eso lo maneja el backend con un mensaje genérico anti-enumeración).
  const recoveryFormatError = validarCorreo(recoveryEmail, false);
  // Validación en tiempo real del login: formato del correo (solo si ya escribió algo)
  // y habilitación del botón mientras falten datos.
  const correoFormatoError = form.Correo ? validarCorreo(form.Correo, false) : '';
  const loginInvalido = !form.Correo || !form.Password || !!correoFormatoError;
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
      const debeCambiar = !!(payload?.debeCambiarPassword ?? payload?.empleado?.debeCambiarPassword ?? payload?.cliente?.debeCambiarPassword);
      if (debeCambiar) {
        navigate('/cambiar-password', { replace: true });
      } else if (payload?.tipo === 'cliente') {
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
    setRecoveryTouched(false);
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
    setRecoveryTouched(true);
    if (recoveryFormatError) return; // formato inválido → no se envía
    sendRecovery(recoveryEmail);
  };

  const handleResend = () => {
    if (resendCountdown > 0) return;
    sendRecovery(recoveryEmail);
  };

  return (
    <div className="min-h-dvh bg-bg font-body text-text">
      {/* Un solo halo frío arriba a la derecha, el mismo de --bg-app. Pintado en
          una capa fija aparte para que no se repinte con el scroll. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10
                   bg-[radial-gradient(1200px_600px_at_100%_-10%,var(--color-primary-50),transparent_62%)]"
      />

      <div className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center gap-xl px-lg py-3xl">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-sm self-start rounded-sm border-0 bg-transparent
                     text-small font-medium text-text-muted cursor-pointer
                     transition-colors duration-150 hover:text-text
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <MdArrowBack size={16} aria-hidden="true" />
          Volver a la página principal
        </button>

        <Motion.main
          initial={{ opacity: 0, y: 14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={RESORTE}
          className="rounded-lg border border-border bg-surface p-2xl shadow-md"
        >
          <header className="mb-xl flex flex-col gap-xs">
            <span className="font-display text-h2 font-extrabold tracking-tighter text-primary">
              SIGOT
            </span>
            <h1 className="font-display text-h1 font-extrabold tracking-tight text-text">
              Iniciar sesión
            </h1>
            <p className="text-body text-text-muted">
              Ingresa tus credenciales para continuar
            </p>
          </header>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-lg">
            {error && (
              <Motion.p
                role="alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={RESORTE}
                className="flex items-center gap-sm rounded-md bg-danger-soft px-lg py-md
                           text-small font-medium text-danger-soft-on"
              >
                <MdLock size={16} aria-hidden="true" />{error}
              </Motion.p>
            )}

            <div className="flex flex-col gap-sm">
              <label htmlFor="login-correo" className={ETIQUETA}>Correo electrónico</label>
              <div className="relative">
                <MdEmail className={ICONO_CAMPO} size={18} aria-hidden="true" />
                <input
                  id="login-correo"
                  type="email" name="Correo" className={CAMPO}
                  placeholder="correo@empresa.com" value={form.Correo}
                  onChange={handleChange} autoComplete="email" required
                  aria-invalid={!!correoFormatoError}
                />
              </div>
              {correoFormatoError && (
                <p className="text-caption font-medium text-danger-soft-on">{correoFormatoError}</p>
              )}
            </div>

            <div className="flex flex-col gap-sm">
              <label htmlFor="login-password" className={ETIQUETA}>Contraseña</label>
              <div className="relative">
                <MdLock className={ICONO_CAMPO} size={18} aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'} name="Password"
                  className={`${CAMPO} pr-[2.75rem]`}
                  placeholder="••••••••" value={form.Password}
                  onChange={handleChange} autoComplete="current-password" required
                />
                <button
                  type="button" tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-sm top-1/2 flex size-9 -translate-y-1/2 items-center
                             justify-center rounded-sm border-0 bg-transparent text-text-light
                             cursor-pointer transition-colors duration-150 hover:text-text"
                >
                  {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className={BOTON_PRIMARIO} disabled={loading || loginInvalido}>
              {loading ? <><Spinner />Iniciando sesión...</> : 'Ingresar'}
            </button>
          </form>

          <button
            type="button"
            onClick={openRecovery}
            className="mt-lg w-full rounded-sm border-0 bg-transparent text-small font-semibold
                       text-primary-soft-on cursor-pointer transition-colors duration-150
                       hover:text-primary-strong-hover
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </Motion.main>

        {/* El modelo pasó de "el taller crea todas las cuentas" a autoregistro para
            CLIENTES. Los empleados siguen recibiendo sus credenciales del admin
            (POST /api/empleados), así que el pie menciona los dos casos. */}
        <p className="text-balance text-center text-small leading-normal text-text-muted">
          ¿Eres cliente y no tienes cuenta?{' '}
          <Link
            to="/registro"
            className="font-semibold text-primary-soft-on underline decoration-primary-pale-2
                       decoration-2 underline-offset-2 hover:text-primary-strong-hover"
          >
            Regístrate aquí
          </Link>
          <br />
          Si eres del equipo del taller, solicita tus credenciales al{' '}
          <strong className="font-semibold text-text">administrador</strong>.
        </p>

        <p className="flex items-center justify-center gap-xs text-caption text-text-light">
          <MdLocationOn size={14} aria-hidden="true" />
          Copacabana, Antioquia · Sistema de gestión de taller
        </p>
      </div>

      {/* ── Recuperación de contraseña ── */}
      <AnimatePresence>
        {showRecovery && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeRecovery}
            /* z-index 1300+: la franja documentada en Layout.css para overlays de
               página, por encima del cajón móvil del sidebar. */
            className="fixed inset-0 z-[1300] flex items-center justify-center
                       bg-[rgb(10_10_11_/_0.55)] p-lg backdrop-blur-[2px]"
          >
            <Motion.div
              role="dialog"
              aria-modal="true"
              aria-label={recoveryStep === 1 ? '¿Olvidaste tu contraseña?' : 'Revisa tu correo'}
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={RESORTE}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-[25rem] rounded-lg border border-border bg-surface shadow-lg"
            >
              <div className="flex items-start justify-between gap-md p-xl pb-lg">
                <h2 className="font-display text-h2 font-bold tracking-tight text-text">
                  {recoveryStep === 1 ? '¿Olvidaste tu contraseña?' : 'Revisa tu correo'}
                </h2>
                <button
                  type="button"
                  onClick={closeRecovery}
                  aria-label="Cerrar"
                  className="flex size-9 shrink-0 items-center justify-center rounded-sm border-0
                             bg-transparent text-text-light cursor-pointer
                             transition-colors duration-150 hover:bg-surface-raised hover:text-text
                             focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <MdClose size={18} />
                </button>
              </div>

              <div className="px-xl pb-xl">
                {recoveryStep === 1 ? (
                  <>
                    <p className="mb-lg text-body leading-normal text-text-muted">
                      Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.
                    </p>

                    <form onSubmit={handleRecoverySubmit} className="flex flex-col gap-lg">
                      <div className="flex flex-col gap-sm">
                        <label htmlFor="recovery-correo" className={ETIQUETA}>
                          Correo electrónico
                        </label>
                        <div className="relative">
                          <MdEmail className={ICONO_CAMPO} size={18} aria-hidden="true" />
                          <input
                            id="recovery-correo"
                            type="email"
                            className={recoveryTouched && recoveryFormatError
                              ? `${CAMPO} border-danger` : CAMPO}
                            placeholder="correo@empresa.com"
                            value={recoveryEmail}
                            onChange={e => { setRecoveryEmail(e.target.value); setRecoveryTouched(true); setRecoveryError(''); }}
                            onBlur={() => setRecoveryTouched(true)}
                            aria-invalid={recoveryTouched && !!recoveryFormatError}
                            autoFocus
                            required
                          />
                        </div>
                        {recoveryTouched && recoveryFormatError && (
                          <p className="text-caption font-medium text-danger-soft-on">{recoveryFormatError}</p>
                        )}
                      </div>

                      {recoveryError && (
                        <p role="alert" className="rounded-md bg-danger-soft px-lg py-md text-small font-medium text-danger-soft-on">
                          {recoveryError}
                        </p>
                      )}

                      <button type="submit" className={BOTON_PRIMARIO} disabled={recoveryLoading || !!recoveryFormatError}>
                        {recoveryLoading
                          ? <><Spinner />Enviando...</>
                          : <><MdSend size={16} aria-hidden="true" />Enviar enlace de recuperación</>
                        }
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-md text-center">
                    <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary-soft-on">
                      <MdEmail size={30} aria-hidden="true" />
                    </span>
                    <p className="font-display text-h3 font-bold text-text">Enlace enviado</p>
                    <p className="text-body leading-normal text-text-muted">
                      Si el correo <strong className="font-semibold text-text">{recoveryEmail}</strong> está
                      registrado en SIGOT, recibirás un enlace en los próximos minutos.
                      <br />El enlace expirará en <strong className="font-semibold text-text">15 minutos</strong>.
                    </p>
                    <p className="text-caption text-text-light">
                      ¿No lo ves? Revisa tu carpeta de spam.
                    </p>

                    <div className="mt-sm flex w-full flex-col gap-sm">
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendCountdown > 0 || recoveryLoading}
                        className="inline-flex w-full items-center justify-center gap-sm rounded-md
                                   border border-border bg-surface px-xl text-body font-semibold text-text
                                   min-h-[var(--touch-min)] cursor-pointer transition-colors duration-150
                                   hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-45
                                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      >
                        {recoveryLoading
                          ? <><Spinner />Reenviando...</>
                          : resendCountdown > 0
                            ? `Reenviar en ${resendCountdown}s`
                            : 'Reenviar'
                        }
                      </button>
                      <button type="button" className={BOTON_PRIMARIO} onClick={closeRecovery}>
                        Entendido
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
