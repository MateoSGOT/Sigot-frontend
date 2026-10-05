import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { MdLock, MdVisibility, MdVisibilityOff, MdCheckCircle, MdArrowBack, MdWarning } from 'react-icons/md';
import api from '../../../shared/services/api.js';
import {
  AUTH_PAGINA, AUTH_CAPA_CUADRICULA, AUTH_CONTENIDO, AUTH_TARJETA, AUTH_TITULO,
  AUTH_APOYO, AUTH_TENUE, AUTH_TENUE_ACCION, AUTH_CAMPO_ACCION,
} from '../../../shared/styles/clasesAuthOscuro.js';

/* ═══════════════════════════════════════════════════════════════════════════
   NUEVA CONTRASEÑA — única vista del panel sobre SUPERFICIE OSCURA.

   SIN CSS PROPIO. ResetPasswordPage.css (245 líneas) eliminado.

   CONTRASTE MEDIDO SOBRE LA TARJETA (--color-surface-dark-raised = #16161A),
   no supuesto. El blanco al 45 % es el PISO para texto normal (4.52:1); por
   debajo de ahí no llega a AA:
       95 %  16.27:1      65 %   8.05:1      45 %   4.52:1
       85 %  13.17:1      50 %   5.31:1      40 %   3.82:1  ← ya no alcanza
       30 %   2.71:1  ← lo que usaba el CSS anterior para los iconos

   Lo que había fallaba en varios sitios: iconos al 30 % (2.71:1), placeholders
   al 20 %, y el enlace de volver al 40 % (3.82:1, solo AA para texto grande).
   Todo subido a 45 % como mínimo, y el texto en reposo a 85-90 %.

   EL BOTÓN DE ACCIÓN PASA DE ÁMBAR A COBALTO. El ámbar en este sistema
   significa "en proceso / requiere atención"; crear la contraseña es la ACCIÓN
   principal. Como relleno con texto blanco el cobalto da 5.15:1 (AA).
   OJO: el cobalto base como TEXTO sobre esta tarjeta da solo 3.50:1, así que
   para texto sobre oscuro se usa --color-primary-light (5.88:1).
   ═══════════════════════════════════════════════════════════════════════════ */

/* El color del indicador cumple DOS funciones con requisitos distintos: rellena
   la barra (no es texto, cualquier tono saturado sirve) y tiñe la etiqueta (sí
   es texto, tiene que llegar a AA sobre la tarjeta oscura). Por eso van
   separados: en el CSS anterior era un solo valor, y dos de los cuatro niveles
   quedaban por debajo de AA en la etiqueta -- "Muy débil" 3.84:1 y "Media"
   3.50:1. */
const NIVELES = {
  weak:   { label: 'Muy débil', ancho: '25%',  barra: 'bg-danger',  texto: 'text-danger-on-dark' },
  fair:   { label: 'Débil',     ancho: '50%',  barra: 'bg-accent',  texto: 'text-accent' },
  medium: { label: 'Media',     ancho: '75%',  barra: 'bg-primary', texto: 'text-primary-light' },
  strong: { label: 'Fuerte',    ancho: '100%', barra: 'bg-success', texto: 'text-success-on-dark' },
};

const getPasswordStrength = (pass) => {
  if (pass.length === 0) return null;
  if (pass.length < 6) return 'weak';
  if (pass.length < 8) return 'fair';
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
  const hasNumber  = /\d/.test(pass);
  const hasUpper   = /[A-Z]/.test(pass);
  if (hasSpecial && hasNumber && hasUpper && pass.length >= 10) return 'strong';
  if ((hasNumber || hasSpecial) && pass.length >= 8) return 'medium';
  return 'fair';
};

/* ── Superficie oscura: compartida con LoginPage ──
   Estas constantes vivian duplicadas aqui. Son las dos pantallas de acceso: un
   usuario las ve con minutos de diferencia y tienen que ser la misma superficie.
   Ver shared/styles/clasesAuthOscuro.js. */
const PAGINA = AUTH_PAGINA;
const TARJETA = AUTH_TARJETA;
const TITULO = AUTH_TITULO;
const APOYO = AUTH_APOYO;
const TENUE = AUTH_TENUE;
const TENUE_ACCION = AUTH_TENUE_ACCION;
const CAMPO = AUTH_CAMPO_ACCION;


/* Cobalto sólido + blanco = 5.15:1 (AA). Era ámbar. */
const BOTON = 'inline-flex w-full items-center justify-center gap-sm rounded-md border-0 '
  + 'bg-primary px-xl text-body font-semibold text-primary-on min-h-[var(--touch-min)] '
  + 'cursor-pointer no-underline transition-[background-color,box-shadow,transform] duration-150 '
  + 'hover:bg-primary-strong hover:shadow-[var(--shadow-green)] active:scale-[0.99] '
  + 'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-primary disabled:hover:shadow-none '
  + 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-light';

function Marca() {
  return (
    <div className="mb-2xl flex items-center justify-center gap-md">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md
                       bg-primary text-h3 font-black text-primary-on">
        S
      </span>
      <span className="font-display text-h2 font-extrabold tracking-tight text-white/90">SIGOT</span>
    </div>
  );
}

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

  const nivel = getPasswordStrength(nuevaPassword);
  const fuerza = nivel ? NIVELES[nivel] : null;
  // Validación en tiempo real (mientras escribe, no solo al enviar).
  const noCoincide   = confirmar.length > 0 && nuevaPassword !== confirmar;
  const formInvalido = nuevaPassword.length < 6 || nuevaPassword !== confirmar;

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

  const campos = [
    {
      id: 'rsp-nueva', label: 'Nueva contraseña', valor: nuevaPassword, set: setNuevaPassword,
      ver: showPass1, setVer: setShowPass1, placeholder: 'Mínimo 6 caracteres', autoFocus: true,
    },
    {
      id: 'rsp-confirmar', label: 'Confirmar contraseña', valor: confirmar, set: setConfirmar,
      ver: showPass2, setVer: setShowPass2, placeholder: 'Repite la contraseña', autoFocus: false,
    },
  ];

  /* ── Token ausente ── */
  if (!token) {
    return (
      <div className={PAGINA}>
        {/* Misma trama que el login: las dos pantallas de acceso son la misma superficie. */}
        <div aria-hidden="true" className={AUTH_CAPA_CUADRICULA} />
        <main className={`${AUTH_CONTENIDO} ${TARJETA} text-center`}>
          <Marca />
          <span className="mb-lg inline-flex text-accent"><MdWarning size={48} aria-hidden="true" /></span>
          <h1 className={TITULO}>Enlace inválido</h1>
          <p className={`${APOYO} mt-sm mb-xl`}>
            Este enlace de recuperación no es válido o ya expiró.
            Solicita uno nuevo desde el login.
          </p>
          <Link to="/login" className={BOTON}>
            <MdArrowBack size={16} aria-hidden="true" />Volver al login
          </Link>
        </main>
      </div>
    );
  }

  /* ── Éxito ── */
  if (success) {
    return (
      <div className={PAGINA}>
        {/* Misma trama que el login: las dos pantallas de acceso son la misma superficie. */}
        <div aria-hidden="true" className={AUTH_CAPA_CUADRICULA} />
        <main className={`${AUTH_CONTENIDO} ${TARJETA} text-center`}>
          <Marca />
          <span className="mb-lg inline-flex text-success-on-dark">
            <MdCheckCircle size={48} aria-hidden="true" />
          </span>
          <h1 className={TITULO}>¡Contraseña actualizada!</h1>
          <p className={`${APOYO} mt-sm`}>Ya puedes iniciar sesión con tu nueva contraseña.</p>
          <p className="mb-xl mt-md text-body font-semibold text-primary-light" aria-live="polite">
            Redirigiendo en {countdown}...
          </p>
          <Link to="/login" className={BOTON}>Ir al login ahora</Link>
        </main>
      </div>
    );
  }

  /* ── Formulario ── */
  return (
    <div className={PAGINA}>
        {/* Misma trama que el login: las dos pantallas de acceso son la misma superficie. */}
        <div aria-hidden="true" className={AUTH_CAPA_CUADRICULA} />
      <main className={`${AUTH_CONTENIDO} ${TARJETA}`}>
        <Marca />

        <header className="mb-xl text-center">
          <h1 className={TITULO}>Nueva contraseña</h1>
          <p className={`${APOYO} mt-xs`}>Crea una contraseña segura para tu cuenta</p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-lg">
          {error && (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger/12 px-lg py-md
                                       text-small font-medium text-danger-on-dark">
              {error}
            </p>
          )}

          {campos.map((c) => (
            <div key={c.id} className="flex flex-col gap-sm">
              <label htmlFor={c.id} className="text-small font-semibold text-white/65">{c.label}</label>
              <div className="relative">
                <MdLock className={`pointer-events-none absolute left-lg top-1/2 -translate-y-1/2 ${TENUE}`}
                        size={18} aria-hidden="true" />
                <input
                  id={c.id}
                  type={c.ver ? 'text' : 'password'}
                  className={CAMPO}
                  value={c.valor}
                  onChange={e => c.set(e.target.value)}
                  placeholder={c.placeholder}
                  autoFocus={c.autoFocus}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button" tabIndex={-1}
                  onClick={() => c.setVer(p => !p)}
                  aria-label={c.ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className={`absolute right-sm top-1/2 flex size-9 -translate-y-1/2 items-center
                              justify-center rounded-sm border-0 bg-transparent cursor-pointer
                              transition-colors duration-150 hover:text-white/90 ${TENUE_ACCION}`}
                >
                  {c.ver ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                </button>
              </div>

              {/* Indicador de fuerza, solo bajo el primer campo */}
              {c.id === 'rsp-nueva' && fuerza && (
                <div className="mt-xs flex items-center gap-md">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-[width,background-color] duration-300 ${fuerza.barra}`}
                      style={{ width: fuerza.ancho }}
                    />
                  </div>
                  <span className={`min-w-[60px] text-right text-caption font-semibold ${fuerza.texto}`}>
                    {fuerza.label}
                  </span>
                </div>
              )}

              {c.id === 'rsp-confirmar' && noCoincide && (
                <p className="text-caption font-medium text-danger-on-dark">Las contraseñas no coinciden.</p>
              )}
            </div>
          ))}

          <button type="submit" className={BOTON} disabled={loading || formInvalido}>
            {loading ? (
              <>
                <span aria-hidden="true"
                      className="size-4 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                Actualizando...
              </>
            ) : 'Actualizar contraseña'}
          </button>
        </form>

        <div className="mt-xl text-center">
          <Link
            to="/login"
            className={`inline-flex items-center gap-xs text-small font-medium no-underline
                        transition-colors duration-150 hover:text-white/90 ${TENUE_ACCION}`}
          >
            <MdArrowBack size={14} aria-hidden="true" />Volver al login
          </Link>
        </div>
      </main>
    </div>
  );
}
