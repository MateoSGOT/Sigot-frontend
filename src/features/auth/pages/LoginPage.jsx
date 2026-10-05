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
import { RESORTE } from '../../../shared/styles/movimiento.js';
import {
  AUTH_PAGINA, AUTH_CAPA_CUADRICULA, AUTH_TARJETA, AUTH_TITULO, AUTH_APOYO,
  AUTH_TENUE, AUTH_TENUE_ACCION, AUTH_CAMPO, AUTH_CAMPO_ACCION, AUTH_ETIQUETA, AUTH_CONTENIDO,
} from '../../../shared/styles/clasesAuthOscuro.js';

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

/* El muelle sale de shared/styles/movimiento.js, el mismo k250/c30/m0.85 que
   usa el resto de la app.

   Antes habia aqui una copia propia con k420/c32/m0.9 y un comentario que decia
   "sin rebote visible". No era cierto: la razon de amortiguamiento de ese
   muelle es z = c/(2*raiz(k*m)) = 32/(2*raiz(420*0.9)) = 0.823, por debajo de 1,
   o sea SUBAMORTIGUADO -- rebotaba. El compartido da z = 30/(2*raiz(250*0.85))
   = 1.029, apenas por encima del critico: llega y se queda.

   Ademas de ser el valor correcto, al importarlo deja de haber dos fisicas
   distintas en la misma aplicacion. */

/* Clases repetidas, extraídas a constantes y no a @apply: con @apply volverían a
   ser CSS propio, que es justo lo que se está quitando. */
/* Clases repetidas, extraidas a constantes y no a @apply: con @apply volverian a
   ser CSS propio, que es justo lo que se esta quitando. Las de superficie oscura
   vienen del modulo compartido con ResetPassword. */
const CAMPO = AUTH_CAMPO;

/* El candado es un adorno junto a un campo que ya tiene etiqueta, asi que puede
   vivir en el piso de AA; el ojo de "mostrar contrasena" se pulsa y no. */
const ICONO_CAMPO = `pointer-events-none absolute left-lg top-1/2 -translate-y-1/2 ${AUTH_TENUE}`;

const ETIQUETA = AUTH_ETIQUETA;

const BOTON_PRIMARIO = 'inline-flex w-full items-center justify-center gap-sm rounded-md '
  + 'bg-primary px-xl text-body font-semibold text-primary-on '
  + 'min-h-[var(--touch-min)] cursor-pointer border-0 '
  + 'transition-[background-color,box-shadow,transform] duration-150 '
  + 'hover:bg-primary-strong active:scale-[0.99] '
  + 'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-primary '
  + 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/* La "G" oficial de Google, en SVG inline y con sus cuatro colores de marca.
   Inline y no <img src>: una peticion a un host externo para pintar un icono
   dentro del login es una dependencia de red innecesaria, y el proyecto ya no
   carga imagenes remotas. Los colores son los de la marca y NO salen de los
   tokens a proposito -- no son parte de la paleta de SIGOT. */
function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

/* Boton de Google. La geometria la hereda de la tarjeta: rounded-2xl (28px, el
   token --radius-2xl), borde sutil y min-h de 48px, el minimo tactil del
   sistema. Sobre superficie oscura la convencion de marca es el boton claro,
   que ademas lo separa con claridad del cobalto primario. */
const BOTON_GOOGLE = 'inline-flex w-full min-h-[48px] items-center justify-center gap-sm '
  + 'rounded-2xl border border-white/14 bg-white/92 px-xl '
  + 'text-body font-semibold text-[#1F1F1F] cursor-pointer '
  + 'transition-[background-color,border-color,transform] duration-150 '
  + 'hover:bg-white hover:border-white/24 active:scale-[0.99] '
  + 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

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
  // Estado puramente de presentacion: explica que el acceso con Google aun no
  // existe. No toca el store ni la logica de autenticacion.
  const [avisoGoogle, setAvisoGoogle] = useState(false);

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
    <div className={`${AUTH_PAGINA} font-body items-start`}>
      {/* Cuadricula matematica al 5%, enmascarada para desvanecerse hacia los
          bordes. En capa fija y propia: una mascara sobre un elemento CON
          contenido obliga a componer todo el subarbol en cada cuadro. */}
      <div aria-hidden="true" className={AUTH_CAPA_CUADRICULA} />

      <div className={`${AUTH_CONTENIDO} mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center gap-xl py-3xl`}>
        <button
          type="button"
          onClick={() => navigate('/')}
          className={`inline-flex items-center gap-sm self-start rounded-sm border-0 bg-transparent
                     text-small font-medium ${AUTH_TENUE_ACCION} cursor-pointer
                     transition-colors duration-150 hover:text-white/90
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
        >
          <MdArrowBack size={16} aria-hidden="true" />
          Volver a la página principal
        </button>

        <Motion.main
          initial={{ opacity: 0, y: 14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={RESORTE}
          className={AUTH_TARJETA}
        >
          <header className="mb-xl flex flex-col gap-xs">
            <span className="font-display text-h2 font-extrabold tracking-tighter text-primary-pale-3">
              SIGOT
            </span>
            <h1 className={AUTH_TITULO}>
              Iniciar sesión
            </h1>
            <p className={AUTH_APOYO}>
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
                  className={AUTH_CAMPO_ACCION}
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

            {/* ── Acceso con Google ──
                El boton entra con el mismo muelle que la tarjeta, un poco
                despues, para que se lea como parte de ella y no como un anadido.

                OJO: HOY NO INICIA SESION. No existe OAuth de Google ni en este
                repositorio ni en la API (no hay cliente, ni ruta, ni
                verificacion de token). Por eso el clic no simula un acceso: dice
                lo que pasa. Un boton con la marca de Google que parece funcionar
                y no hace nada es peor que no tenerlo.
                Para habilitarlo hacen falta tres cosas: un Client ID de Google,
                una ruta en la API que verifique el id_token contra Google y
                resuelva/cree el usuario, y el envio de ese token desde aqui. */}
            <div className="flex flex-col gap-sm">
              <div className="flex items-center gap-md" aria-hidden="true">
                <span className="h-px flex-1 bg-white/12" />
                <span className={`text-caption ${AUTH_TENUE}`}>o</span>
                <span className="h-px flex-1 bg-white/12" />
              </div>

              <Motion.button
                type="button"
                onClick={() => setAvisoGoogle(true)}
                className={BOTON_GOOGLE}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...RESORTE, delay: 0.08 }}
              >
                <LogoGoogle />
                Sign in with Google
              </Motion.button>

              {avisoGoogle && (
                <Motion.p
                  role="status"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={RESORTE}
                  className={`text-caption ${AUTH_APOYO}`}
                >
                  El acceso con Google todavía no está habilitado. Ingresa con tu
                  correo y contraseña.
                </Motion.p>
              )}
            </div>
          </form>

          <button
            type="button"
            onClick={openRecovery}
            className="mt-lg w-full rounded-sm border-0 bg-transparent text-small font-semibold
                       text-primary-pale-3 cursor-pointer transition-colors duration-150
                       hover:text-white/90
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </Motion.main>

        {/* El modelo pasó de "el taller crea todas las cuentas" a autoregistro para
            CLIENTES. Los empleados siguen recibiendo sus credenciales del admin
            (POST /api/empleados), así que el pie menciona los dos casos. */}
        <p className={`text-balance text-center text-small leading-normal ${AUTH_TENUE_ACCION}`}>
          ¿Eres cliente y no tienes cuenta?{' '}
          <Link
            to="/registro"
            className="font-semibold text-primary-pale-3 underline decoration-primary/60
                       decoration-2 underline-offset-2 hover:text-white/90"
          >
            Regístrate aquí
          </Link>
          <br />
          Si eres del equipo del taller, solicita tus credenciales al{' '}
          <strong className="font-semibold text-white/90">administrador</strong>.
        </p>

        <p className={`flex items-center justify-center gap-xs text-caption ${AUTH_TENUE_ACCION}`}>
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
