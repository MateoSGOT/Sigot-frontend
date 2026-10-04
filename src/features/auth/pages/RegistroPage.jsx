import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import {
  MdEmail, MdLock, MdVisibility, MdVisibilityOff, MdArrowBack,
  MdBadge, MdPerson, MdPhone, MdShield,
} from 'react-icons/md';
import { registroService } from '../services/registroService.js';
import { completarRegistroThunk, clearError } from '../slices/authSlice.js';
import {
  correo as validarCorreo,
  passwordFuerte as validarPassword,
  confirmarPassword as validarConfirmacion,
} from '../../../shared/utils/validators.js';
import {
  BarraProgreso, CampoFlotante, CampoSelect, CodigoOtp, BotonFlujo,
  PasoAnimado,
} from '../../../shared/components/FlujoProgresivo/FlujoProgresivo.jsx';
import { useFlujoProgresivo } from '../../../shared/components/FlujoProgresivo/useFlujoProgresivo.js';

/* Autoregistro de clientes en 3 pasos. La transición de slide, la barra de progreso y los
   campos salen de FlujoProgresivo (compartidos con el agendamiento público, AgendarCitaPage)
   para que las dos pantallas se vean y se comporten igual y no divergan. */

const PASOS = ['Cuenta', 'Verificación', 'Tus datos'];
const OTP_LARGO = 6;
const REENVIO_COOLDOWN = 60; // mismo criterio que la recuperación de contraseña en LoginPage

export default function RegistroPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading: loadingSesion } = useSelector((s) => s.auth);

  const { paso, direccion, irAPaso, vibrar, error, setError, claseCuerpo } = useFlujoProgresivo(1);
  const [cargando, setCargando] = useState(false);

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
    if (reenvioRef.current) clearInterval(reenvioRef.current);
    dispatch(clearError());
  }, [dispatch]);

  // El catálogo de tipos de documento es público, pero solo se necesita en el paso 3: se
  // pide al entrar ahí para no gastar un request en quien abandona antes.
  useEffect(() => {
    if (paso !== 3 || tiposDoc.length) return;
    let vivo = true;
    registroService.getTiposDocumento()
      .then((lista) => { if (vivo) setTiposDoc(lista); })
      .catch(() => { if (vivo) setError('No pudimos cargar los tipos de documento.'); });
    return () => { vivo = false; };
  }, [paso, tiposDoc.length, setError]);

  const arrancarCooldown = useCallback(() => {
    setReenvio(REENVIO_COOLDOWN);
    reenvioRef.current = setInterval(() => {
      setReenvio((prev) => {
        if (prev <= 1) { clearInterval(reenvioRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  /* ── Validaciones en vivo (validadores compartidos: misma regla de contraseña que el
     resto de la app y que el backend -- mín 8, letra + número) ── */
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

  const cambiarCuenta = (e) => { setCuenta((p) => ({ ...p, [e.target.name]: e.target.value })); setError(''); };
  const cambiarDatos  = (e) => { setDatos((p) => ({ ...p, [e.target.name]: e.target.value })); setError(''); };
  const marcarTocado  = (e) => setTocado((p) => ({ ...p, [e.target.name]: true }));

  /* ── Paso 1 → 2 ── */
  const enviarPaso1 = async (e) => {
    e.preventDefault();
    setTocado({ Correo: true, Password: true, ConfirmarPassword: true });
    if (!paso1Listo) { vibrar('Revisa los datos antes de continuar.'); return; }
    setCargando(true);
    try {
      await registroService.registrar(cuenta.Correo, cuenta.Password, cuenta.ConfirmarPassword);
      setCodigo('');
      arrancarCooldown();
      irAPaso(2);
    } catch (err) {
      vibrar(err?.response?.data?.message || 'No pudimos crear tu cuenta. Intenta de nuevo.');
    } finally { setCargando(false); }
  };

  /* ── Paso 2 → 3 ── */
  const enviarPaso2 = async (e) => {
    e.preventDefault();
    if (codigo.length !== OTP_LARGO) { vibrar('Escribe los 6 dígitos del código.'); return; }
    setCargando(true);
    try {
      await registroService.verificarCodigo(cuenta.Correo, codigo);
      irAPaso(3);
    } catch (err) {
      vibrar(err?.response?.data?.message || 'El código no es correcto.');
      setCodigo('');
    } finally { setCargando(false); }
  };

  const reenviarCodigo = async () => {
    if (reenvio > 0) return;
    setCargando(true);
    try {
      await registroService.reenviarCodigo(cuenta.Correo);
      setCodigo('');
      arrancarCooldown();
    } catch (err) {
      vibrar(err?.response?.data?.message || 'No pudimos reenviar el código.');
    } finally { setCargando(false); }
  };

  /* ── Paso 3 → portal ── */
  const enviarPaso3 = async (e) => {
    e.preventDefault();
    if (!paso3Listo) { vibrar('Completa todos los campos para terminar.'); return; }
    const res = await dispatch(completarRegistroThunk({
      Correo: cuenta.Correo,
      Nombre: datos.Nombre.trim(),
      Documento: datos.Documento.trim(),
      Id_TipoDoc: Number(datos.Id_TipoDoc),
      Contacto: datos.Contacto.trim(),
    }));
    if (res.error) { vibrar(res.payload || 'No pudimos completar tu registro.'); return; }
    navigate('/portal', { replace: true });
  };

  const ocupado = cargando || loadingSesion;

  return (
    <div className="flujo-page">
      <div className="flujo-card">
        <header className="flujo-card__header">
          <Link to="/login" className="flujo-volver"><MdArrowBack size={18} /> Volver</Link>
          <div className="flujo-marca">
            <span className="flujo-marca__logo">S</span>
            <span className="flujo-marca__nombre">SIGOT</span>
          </div>
        </header>

        <BarraProgreso pasos={PASOS} paso={paso} />

        {/* El deslizamiento entre pasos lo resuelve PasoAnimado con un spring de
            Motion y AnimatePresence mode="wait". Antes eran keyframes CSS
            coreografiados con setTimeout en el hook. */}
        <PasoAnimado paso={paso} direccion={direccion} className={claseCuerpo}>
          {/* ════════ PASO 1 — Cuenta ════════ */}
          {paso === 1 && (
            <form onSubmit={enviarPaso1} noValidate>
              <h1 className="flujo-titulo">Crea tu cuenta</h1>
              <p className="flujo-sub">
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
                valido={!!cuenta.ConfirmarPassword && !validarConfirmacion(cuenta.ConfirmarPassword, cuenta.Password)}
              />

              {error && <p className="flujo-error" role="alert">{error}</p>}
              <BotonFlujo cargando={ocupado}>Continuar</BotonFlujo>
              <p className="flujo-pie">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
            </form>
          )}

          {/* ════════ PASO 2 — Verificación ════════ */}
          {paso === 2 && (
            <form onSubmit={enviarPaso2} noValidate>
              <h1 className="flujo-titulo">Verifica tu correo</h1>
              <p className="flujo-sub">
                Enviamos un código de 6 dígitos a <strong>{cuenta.Correo}</strong>
              </p>

              <CodigoOtp
                valor={codigo} onChange={(v) => { setCodigo(v); setError(''); }}
                error={!!error} deshabilitado={ocupado}
              />

              {error && <p className="flujo-error" role="alert">{error}</p>}
              <BotonFlujo cargando={ocupado} disabled={codigo.length !== OTP_LARGO}>Verificar</BotonFlujo>

              <div className="flujo-reenvio">
                {reenvio > 0 ? (
                  <span className="flujo-reenvio__espera">Puedes reenviar el código en {reenvio}s</span>
                ) : (
                  <button type="button" className="flujo-reenvio__btn" onClick={reenviarCodigo} disabled={ocupado}>
                    Reenviar código
                  </button>
                )}
              </div>
            </form>
          )}

          {/* ════════ PASO 3 — Datos legales ════════ */}
          {paso === 3 && (
            <form onSubmit={enviarPaso3} noValidate>
              <h1 className="flujo-titulo">Tus datos</h1>
              <p className="flujo-sub">Último paso para terminar de crear tu cuenta.</p>

              <CampoFlotante
                id="reg-nombre" name="Nombre" label="Nombre completo"
                value={datos.Nombre} onChange={cambiarDatos}
                icon={MdPerson} autoComplete="name"
                valido={datos.Nombre.trim().length >= 3}
              />

              <CampoSelect
                id="reg-tipodoc" name="Id_TipoDoc" icon={MdBadge}
                value={datos.Id_TipoDoc} onChange={cambiarDatos}
                placeholder="Tipo de documento"
                options={tiposDoc.map((t) => ({ value: t.Id_TipoDoc, label: t.Nombre }))}
              />

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

              <p className="flujo-aviso">
                <MdShield size={15} aria-hidden="true" />
                Tu documento de identidad es requerido exclusivamente para la asignación legal
                de tus órdenes de trabajo
              </p>

              {error && <p className="flujo-error" role="alert">{error}</p>}
              <BotonFlujo cargando={ocupado}>Finalizar registro</BotonFlujo>
            </form>
          )}
        </PasoAnimado>
      </div>
    </div>
  );
}
