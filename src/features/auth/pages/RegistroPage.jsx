import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import {
  MdEmail, MdLock, MdVisibility, MdVisibilityOff, MdCheck, MdArrowBack,
  MdBadge, MdPerson, MdPhone, MdShield,
} from 'react-icons/md';
import { registroService } from '../services/registroService.js';
import { completarRegistroThunk, clearError } from '../slices/authSlice.js';
import {
  correo as validarCorreo,
  passwordFuerte as validarPassword,
  confirmarPassword as validarConfirmacion,
} from '../../../shared/utils/validators.js';
import './RegistroPage.css';

const PASOS = ['Cuenta', 'Verificación', 'Tus datos'];
const OTP_LARGO = 6;
const REENVIO_COOLDOWN = 60; // mismo criterio que la recuperación de contraseña en LoginPage

// Las animaciones de este flujo se saltan por completo si el sistema pide menos
// movimiento. Mismo criterio que CountUp y LandingPage.
const sinMovimiento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const DUR_SALIDA = 220;  // ms — debe coincidir con --registro-dur-salida en el CSS
const DUR_ENTRADA = 260; // ms — debe coincidir con --registro-dur-entrada

/* ─── Input con label flotante, check de validez y shake de error ─── */
function CampoFlotante({
  id, name, label, type = 'text', value, onChange, icon: Icon, error, valido,
  autoComplete, inputMode, maxLength, children, onBlur,
}) {
  return (
    <div className={`campo${error ? ' campo--error' : ''}`}>
      <div className="campo__caja">
        {Icon && <Icon className="campo__icono" size={19} aria-hidden="true" />}
        <input
          id={id}
          name={name}
          type={type}
          className="campo__input"
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          /* El placeholder en blanco es lo que permite animar el label con
             :placeholder-shown -- sin él el label nunca baja. */
          placeholder=" "
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <label htmlFor={id} className="campo__label">{label}</label>
        {valido && !error && <MdCheck className="campo__check" size={18} aria-hidden="true" />}
        {children}
      </div>
      {error && <span id={`${id}-error`} className="campo__msg-error" role="alert">{error}</span>}
    </div>
  );
}

/* ─── 6 inputs de un dígito con foco secuencial ─── */
function CodigoOtp({ valor, onChange, error, deshabilitado }) {
  const refs = useRef([]);

  const setDigito = (i, digito) => {
    const siguiente = valor.split('');
    siguiente[i] = digito;
    onChange(siguiente.join('').slice(0, OTP_LARGO));
  };

  const handleChange = (i) => (e) => {
    const limpio = e.target.value.replace(/\D/g, '');
    if (!limpio) { setDigito(i, ''); return; }
    // Pegar el código completo desde el correo: se reparte en todas las casillas
    // en vez de meter 6 dígitos en la primera.
    if (limpio.length > 1) {
      const relleno = (valor.slice(0, i) + limpio).slice(0, OTP_LARGO);
      onChange(relleno);
      refs.current[Math.min(relleno.length, OTP_LARGO - 1)]?.focus();
      return;
    }
    setDigito(i, limpio);
    if (i < OTP_LARGO - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i) => (e) => {
    // Backspace en una casilla vacía retrocede, que es lo que uno espera al corregir.
    if (e.key === 'Backspace' && !valor[i] && i > 0) {
      e.preventDefault();
      setDigito(i - 1, '');
      refs.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < OTP_LARGO - 1) refs.current[i + 1]?.focus();
  };

  return (
    <div className={`otp${error ? ' otp--error' : ''}`} role="group" aria-label="Código de verificación">
      {Array.from({ length: OTP_LARGO }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className={`otp__caja${valor[i] ? ' otp__caja--lleno' : ''}`}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={OTP_LARGO}
          value={valor[i] || ''}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          disabled={deshabilitado}
          aria-label={`Dígito ${i + 1} de ${OTP_LARGO}`}
        />
      ))}
    </div>
  );
}

export default function RegistroPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading: loadingSesion } = useSelector((s) => s.auth);

  const [paso, setPaso] = useState(1);
  // 'saliendo' | 'entrando' | null -- maneja el slide horizontal entre pasos.
  const [transicion, setTransicion] = useState(null);
  const [shake, setShake] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [errorApi, setErrorApi] = useState('');
  const temporizadores = useRef([]);

  // Paso 1
  const [cuenta, setCuenta] = useState({ Correo: '', Password: '', ConfirmarPassword: '' });
  const [verPassword, setVerPassword] = useState(false);
  const [tocado, setTocado] = useState({});

  // Paso 2
  const [codigo, setCodigo] = useState('');
  const [reenvio, setReenvio] = useState(0);
  const reenvioRef = useRef(null);

  // Paso 3
  const [datos, setDatos] = useState({ Nombre: '', Documento: '', Id_TipoDoc: '', Contacto: '' });
  const [tiposDoc, setTiposDoc] = useState([]);

  useEffect(() => () => {
    temporizadores.current.forEach(clearTimeout);
    if (reenvioRef.current) clearInterval(reenvioRef.current);
    dispatch(clearError());
  }, [dispatch]);

  // El catálogo de tipos de documento es público, pero solo se necesita en el paso 3:
  // se pide al entrar ahí para no gastar un request en quien abandona antes.
  useEffect(() => {
    if (paso !== 3 || tiposDoc.length) return;
    let vivo = true;
    registroService.getTiposDocumento()
      .then((lista) => { if (vivo) setTiposDoc(lista); })
      .catch(() => { if (vivo) setErrorApi('No pudimos cargar los tipos de documento.'); });
    return () => { vivo = false; };
  }, [paso, tiposDoc.length]);

  const programar = (fn, ms) => { temporizadores.current.push(setTimeout(fn, ms)); };

  const irAPaso = useCallback((destino) => {
    if (sinMovimiento()) { setPaso(destino); return; }
    setTransicion('saliendo');
    programar(() => {
      setPaso(destino);
      setTransicion('entrando');
      programar(() => setTransicion(null), DUR_ENTRADA);
    }, DUR_SALIDA);
  }, []);

  const vibrar = (mensaje) => {
    setErrorApi(mensaje);
    setShake(true);
    programar(() => setShake(false), 420);
  };

  const arrancarCooldown = () => {
    setReenvio(REENVIO_COOLDOWN);
    reenvioRef.current = setInterval(() => {
      setReenvio((prev) => {
        if (prev <= 1) { clearInterval(reenvioRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  /* ── Validaciones en vivo (reusa los validadores compartidos: misma regla de
     contraseña que el resto de la app y que el backend -- mín 8, letra + número) ── */
  const errCorreo = tocado.Correo && cuenta.Correo ? validarCorreo(cuenta.Correo, false) : '';
  const passwordDebil = cuenta.Password ? validarPassword(cuenta.Password) : '';
  const errPassword = tocado.Password ? passwordDebil : '';
  const errConfirmar = tocado.ConfirmarPassword && cuenta.ConfirmarPassword
    ? validarConfirmacion(cuenta.ConfirmarPassword, cuenta.Password)
    : '';
  const paso1Listo = !validarCorreo(cuenta.Correo, false) && !validarPassword(cuenta.Password)
    && !validarConfirmacion(cuenta.ConfirmarPassword, cuenta.Password);

  const paso3Listo = datos.Nombre.trim().length >= 3 && datos.Documento.trim().length >= 5
    && !!datos.Id_TipoDoc && datos.Contacto.trim().length >= 7;

  const cambiarCuenta = (e) => {
    setCuenta((p) => ({ ...p, [e.target.name]: e.target.value }));
    setErrorApi('');
  };
  const cambiarDatos = (e) => {
    setDatos((p) => ({ ...p, [e.target.name]: e.target.value }));
    setErrorApi('');
  };
  const marcarTocado = (e) => setTocado((p) => ({ ...p, [e.target.name]: true }));

  /* ── Paso 1 → 2 ── */
  const enviarPaso1 = async (e) => {
    e.preventDefault();
    setTocado({ Correo: true, Password: true, ConfirmarPassword: true });
    if (!paso1Listo) { vibrar('Revisa los datos antes de continuar.'); return; }
    setCargando(true);
    setErrorApi('');
    try {
      await registroService.registrar(cuenta.Correo, cuenta.Password, cuenta.ConfirmarPassword);
      setCodigo('');
      arrancarCooldown();
      irAPaso(2);
    } catch (err) {
      vibrar(err?.response?.data?.message || 'No pudimos crear tu cuenta. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  /* ── Paso 2 → 3 ── */
  const enviarPaso2 = async (e) => {
    e.preventDefault();
    if (codigo.length !== OTP_LARGO) { vibrar('Escribe los 6 dígitos del código.'); return; }
    setCargando(true);
    setErrorApi('');
    try {
      await registroService.verificarCodigo(cuenta.Correo, codigo);
      irAPaso(3);
    } catch (err) {
      vibrar(err?.response?.data?.message || 'El código no es correcto.');
      setCodigo('');
    } finally {
      setCargando(false);
    }
  };

  const reenviarCodigo = async () => {
    if (reenvio > 0) return;
    setCargando(true);
    setErrorApi('');
    try {
      await registroService.reenviarCodigo(cuenta.Correo);
      setCodigo('');
      arrancarCooldown();
    } catch (err) {
      vibrar(err?.response?.data?.message || 'No pudimos reenviar el código.');
    } finally {
      setCargando(false);
    }
  };

  /* ── Paso 3 → portal ── */
  const enviarPaso3 = async (e) => {
    e.preventDefault();
    if (!paso3Listo) { vibrar('Completa todos los campos para terminar.'); return; }
    setErrorApi('');
    const res = await dispatch(completarRegistroThunk({
      Correo: cuenta.Correo,
      Nombre: datos.Nombre.trim(),
      Documento: datos.Documento.trim(),
      Id_TipoDoc: Number(datos.Id_TipoDoc),
      Contacto: datos.Contacto.trim(),
    }));
    if (res.error) {
      vibrar(res.payload || 'No pudimos completar tu registro.');
      return;
    }
    navigate('/portal', { replace: true });
  };

  const ocupado = cargando || loadingSesion;
  const claseTransicion = transicion ? ` registro-card__cuerpo--${transicion}` : '';

  return (
    <div className="registro-page">
      <div className="registro-card">
        <header className="registro-card__header">
          <Link to="/login" className="registro-volver">
            <MdArrowBack size={18} /> Volver
          </Link>
          <div className="registro-marca">
            <span className="registro-marca__logo">S</span>
            <span className="registro-marca__nombre">SIGOT</span>
          </div>
        </header>

        {/* Barra de progreso líquida */}
        <div className="registro-progreso" role="group" aria-label={`Paso ${paso} de ${PASOS.length}`}>
          <div className="registro-progreso__riel">
            <div
              className="registro-progreso__relleno"
              style={{ width: `${((paso - 1) / (PASOS.length - 1)) * 100}%` }}
            />
          </div>
          <ol className="registro-progreso__pasos">
            {PASOS.map((nombre, i) => {
              const numero = i + 1;
              const completo = numero < paso;
              const activo = numero === paso;
              return (
                <li
                  key={nombre}
                  className={`registro-paso${completo ? ' registro-paso--completo' : ''}${activo ? ' registro-paso--activo' : ''}`}
                >
                  <span className="registro-paso__bolita" aria-hidden="true">
                    {completo ? <MdCheck size={15} /> : numero}
                  </span>
                  <span className="registro-paso__nombre">{nombre}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className={`registro-card__cuerpo${claseTransicion}${shake ? ' registro-card__cuerpo--shake' : ''}`}>
          {/* ════════ PASO 1 — Cuenta ════════ */}
          {paso === 1 && (
            <form onSubmit={enviarPaso1} noValidate>
              <h1 className="registro-titulo">Crea tu cuenta</h1>
              <p className="registro-sub">
                Crea tu cuenta para comenzar a gestionar tus órdenes de trabajo de forma segura
              </p>

              <CampoFlotante
                id="reg-correo" name="Correo" label="Correo electrónico" type="email"
                value={cuenta.Correo} onChange={cambiarCuenta} onBlur={marcarTocado}
                icon={MdEmail} error={errCorreo} autoComplete="email"
                valido={!!cuenta.Correo && !validarCorreo(cuenta.Correo, false)}
              />

              <CampoFlotante
                id="reg-password" name="Password" label="Contraseña"
                type={verPassword ? 'text' : 'password'}
                value={cuenta.Password} onChange={cambiarCuenta} onBlur={marcarTocado}
                icon={MdLock} error={errPassword} autoComplete="new-password"
                valido={!!cuenta.Password && !passwordDebil}
              >
                <button
                  type="button" className="campo__ojo" onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {verPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                </button>
              </CampoFlotante>

              <CampoFlotante
                id="reg-confirmar" name="ConfirmarPassword" label="Confirmar contraseña"
                type={verPassword ? 'text' : 'password'}
                value={cuenta.ConfirmarPassword} onChange={cambiarCuenta} onBlur={marcarTocado}
                icon={MdLock} error={errConfirmar} autoComplete="new-password"
                valido={!!cuenta.ConfirmarPassword && cuenta.ConfirmarPassword === cuenta.Password && !passwordDebil}
              />

              {errorApi && <p className="registro-error" role="alert">{errorApi}</p>}

              <button type="submit" className={`registro-btn${ocupado ? ' registro-btn--cargando' : ''}`} disabled={ocupado}>
                {ocupado ? <span className="registro-spinner" aria-hidden="true" /> : 'Continuar'}
              </button>

              <p className="registro-pie">
                ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
              </p>
            </form>
          )}

          {/* ════════ PASO 2 — Verificación ════════ */}
          {paso === 2 && (
            <form onSubmit={enviarPaso2} noValidate>
              <h1 className="registro-titulo">Verifica tu correo</h1>
              <p className="registro-sub">
                Enviamos un código de 6 dígitos a <strong>{cuenta.Correo}</strong>
              </p>

              <CodigoOtp valor={codigo} onChange={(v) => { setCodigo(v); setErrorApi(''); }} error={!!errorApi} deshabilitado={ocupado} />

              {errorApi && <p className="registro-error" role="alert">{errorApi}</p>}

              <button
                type="submit"
                className={`registro-btn${ocupado ? ' registro-btn--cargando' : ''}`}
                disabled={ocupado || codigo.length !== OTP_LARGO}
              >
                {ocupado ? <span className="registro-spinner" aria-hidden="true" /> : 'Verificar'}
              </button>

              <div className="registro-reenvio">
                {reenvio > 0 ? (
                  <span className="registro-reenvio__espera">
                    Puedes reenviar el código en {reenvio}s
                  </span>
                ) : (
                  <button type="button" className="registro-reenvio__btn" onClick={reenviarCodigo} disabled={ocupado}>
                    Reenviar código
                  </button>
                )}
              </div>
            </form>
          )}

          {/* ════════ PASO 3 — Datos legales ════════ */}
          {paso === 3 && (
            <form onSubmit={enviarPaso3} noValidate>
              <h1 className="registro-titulo">Tus datos</h1>
              <p className="registro-sub">Último paso para terminar de crear tu cuenta.</p>

              <CampoFlotante
                id="reg-nombre" name="Nombre" label="Nombre completo"
                value={datos.Nombre} onChange={cambiarDatos}
                icon={MdPerson} autoComplete="name"
                valido={datos.Nombre.trim().length >= 3}
              />

              <div className="campo">
                <div className="campo__caja">
                  <MdBadge className="campo__icono" size={19} aria-hidden="true" />
                  <select
                    id="reg-tipodoc" name="Id_TipoDoc"
                    className="campo__input campo__input--select"
                    value={datos.Id_TipoDoc} onChange={cambiarDatos}
                  >
                    <option value="">Tipo de documento</option>
                    {tiposDoc.map((t) => (
                      <option key={t.Id_TipoDoc} value={t.Id_TipoDoc}>{t.Nombre}</option>
                    ))}
                  </select>
                  {!!datos.Id_TipoDoc && <MdCheck className="campo__check" size={18} aria-hidden="true" />}
                </div>
              </div>

              <CampoFlotante
                id="reg-documento" name="Documento" label="Número de identificación"
                value={datos.Documento} onChange={cambiarDatos}
                icon={MdBadge} inputMode="numeric" maxLength={20}
                valido={datos.Documento.trim().length >= 5}
              />

              <CampoFlotante
                id="reg-contacto" name="Contacto" label="Teléfono"
                value={datos.Contacto} onChange={cambiarDatos}
                icon={MdPhone} inputMode="tel" autoComplete="tel" maxLength={50}
                valido={datos.Contacto.trim().length >= 7}
              />

              <p className="registro-aviso-legal">
                <MdShield size={15} aria-hidden="true" />
                Tu documento de identidad es requerido exclusivamente para la asignación legal
                de tus órdenes de trabajo
              </p>

              {errorApi && <p className="registro-error" role="alert">{errorApi}</p>}

              <button type="submit" className={`registro-btn${ocupado ? ' registro-btn--cargando' : ''}`} disabled={ocupado}>
                {ocupado ? <span className="registro-spinner" aria-hidden="true" /> : 'Finalizar registro'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
