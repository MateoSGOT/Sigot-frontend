import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import {
  MdEmail, MdLock, MdVisibility, MdVisibilityOff, MdArrowBack, MdBadge, MdPerson,
  MdPhone, MdShield, MdDirectionsCar, MdPalette, MdEventNote, MdCalendarToday,
  MdSchedule, MdBuild,
} from 'react-icons/md';
import { registroService } from '../../auth/services/registroService.js';
import { completarRegistroThunk } from '../../auth/slices/authSlice.js';
import { portalService } from '../services/portalService.js';
import {
  correo as validarCorreo,
  passwordFuerte as validarPassword,
  confirmarPassword as validarConfirmacion,
  placa as validarPlaca,
  normalizarPlaca,
} from '../../../shared/utils/validators.js';
import { todayLocalYMD } from '../../../shared/utils/helpers.js';
import {
  BarraProgreso, CampoFlotante, CampoSelect, CodigoOtp, BotonFlujo, CargaUnificada,
  PasoAnimado,
} from '../../../shared/components/FlujoProgresivo/FlujoProgresivo.jsx';
import { useFlujoProgresivo } from '../../../shared/components/FlujoProgresivo/useFlujoProgresivo.js';

/* ═══════════════════════════════════════════════════════════════════════════
   Agendamiento público con autoregistro en caliente.

   Regla de negocio: para agendar hace falta un vehículo registrado. Para no perder
   clientes nuevos, cuenta + vehículo + cita se crean en el MISMO flujo, sin salir de
   la pantalla.

   El flujo se arma dinámicamente según el estado de quien entra:
     - sin sesión          -> Cuenta · Código · Vehículo · Cita
     - con sesión, 0 autos -> Vehículo · Cita
     - con sesión, con autos -> Cita (elige el vehículo ahí mismo, un solo paso)

   Por qué hay un paso de Código: el registro exige verificar el correo
   (auth.service.js::completarRegistro falla si Verificado !== true). Ese candado evita
   que alguien agende con el correo de un tercero y le quede una cuenta creada. Es una
   diapositiva más del mismo slide, así que no rompe el "sin salir de la pantalla".
   ═══════════════════════════════════════════════════════════════════════════ */

const REENVIO_COOLDOWN = 60;
const OTP_LARGO = 6;

// El horario real del taller vive en GET /api/agenda/horario, que exige sesión -- un
// visitante anónimo no puede consultarlo. Se usan los mismos valores por defecto a los
// que ya cae PortalPage cuando esa llamada falla. Si la hora elegida no sirve, la API lo
// rechaza al crear la cita (ahí sí con las reglas reales de horario y ocupación).
const HORA_APERTURA = 8;
const HORA_CIERRE = 18;

// Franjas del dia. Si la fecha elegida es HOY, se descartan las que ya pasaron: si no,
// el select las ofrecia igual y el usuario podia elegir una hora anterior a la actual
// (el backend la rechazaba recien al confirmar, ya con la cuenta y el vehiculo creados).
// Se deja un margen de 30 min: no tiene sentido ofrecer una franja que arranca en 5 min.
const MARGEN_MIN = 30;
const aMinutos = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

// Franjas realmente ofrecibles para una fecha. Descarta:
//   - las que caen fuera del horario de atención (el real si hay sesión, el por defecto si no),
//   - las que YA PASARON cuando la fecha es hoy (con 30 min de margen: no tiene sentido
//     ofrecer una franja que arranca en 5 min),
//   - las ocupadas por el técnico elegido, comparando SOLAPAMIENTO y no igualdad de hora:
//     una cita de 60 min que empieza 14:00 también bloquea las 14:30.
const horasDisponibles = (fechaYMD, { horario, ocupadas = [], duracionMin = 60 } = {}) => {
  const apertura = horario?.apertura ? aMinutos(horario.apertura) : HORA_APERTURA * 60;
  const cierre   = horario?.cierre   ? aMinutos(horario.cierre)   : HORA_CIERRE * 60;
  const esHoy = fechaYMD === todayLocalYMD();
  const ahora = new Date();
  const minutoCorte = esHoy ? ahora.getHours() * 60 + ahora.getMinutes() + MARGEN_MIN : -1;

  const out = [];
  for (let mins = apertura; mins < cierre; mins += 30) {
    if (mins <= minutoCorte) continue;
    const choca = ocupadas.some((o) => {
      const ini = aMinutos(o.Hora);
      const fin = ini + Number(o.DuracionEstimadaMin || 60);
      return mins < fin && ini < mins + duracionMin;
    });
    if (choca) continue;
    out.push(`${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`);
  }
  return out;
};

const TIPOS_CITA = [
  { value: 'Mantenimiento', label: 'Mantenimiento / reparación' },
  { value: 'Diagnostico',   label: 'Diagnóstico' },
];

export default function AgendarCitaPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token, tipo, cliente } = useSelector((s) => s.auth);

  // Un empleado no agenda por acá (tiene el panel del taller). Se lo manda al dashboard.
  const esClienteConSesion = !!token && tipo === 'cliente';

  const [vehiculos, setVehiculos] = useState(null); // null = aún no se consultó
  const [cargandoInicial, setCargandoInicial] = useState(esClienteConSesion);

  /* ── Datos del formulario ── */
  const [cuenta, setCuenta] = useState({
    Correo: '', Password: '', ConfirmarPassword: '', Nombre: '', Contacto: '',
    Id_TipoDoc: '', Documento: '',
  });
  const [verPassword, setVerPassword] = useState(false);
  const [tocado, setTocado] = useState({});
  const [tiposDoc, setTiposDoc] = useState([]);

  const [codigo, setCodigo] = useState('');
  const [reenvio, setReenvio] = useState(0);
  const reenvioRef = useRef(null);

  const [vehiculo, setVehiculo] = useState({ Placa: '', Anio: '', Color: '' });
  const [vehiculoElegido, setVehiculoElegido] = useState('');
  const [usarNuevoVehiculo, setUsarNuevoVehiculo] = useState(false);

  const [cita, setCita] = useState({ Fecha: '', Hora: '', TipoCita: 'Mantenimiento', Descripcion: '', Id_Empleado: '' });

  // Disponibilidad real. Solo se puede consultar CON sesion (los tres endpoints la exigen),
  // asi que en el flujo anonimo quedan vacios y se usan los valores por defecto -- la API
  // valida igual al confirmar. Esto reemplaza lo que aportaba el modal viejo del portal.
  const [horario, setHorario] = useState(null);
  const [empleadosDisp, setEmpleadosDisp] = useState([]);
  const [horasOcupadas, setHorasOcupadas] = useState([]);

  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);   // envío final (los POST secuenciales)
  const [etapaEnvio, setEtapaEnvio] = useState(0);

  const { paso, direccion, irAPaso, vibrar, error, setError, claseCuerpo } = useFlujoProgresivo(1);

  /* ── Pasos del flujo, segun el estado de quien entra ── */
  const tieneVehiculos = Array.isArray(vehiculos) && vehiculos.length > 0;
  const pasos = useMemo(() => {
    if (!esClienteConSesion) return ['Cuenta', 'Código', 'Vehículo', 'Cita'];
    if (tieneVehiculos && !usarNuevoVehiculo) return ['Cita'];
    return ['Vehículo', 'Cita'];
  }, [esClienteConSesion, tieneVehiculos, usarNuevoVehiculo]);

  // Nombre del paso actual: se razona por NOMBRE y no por número, porque la cantidad de
  // pasos cambia segun el caso (4, 2 o 1) y un switch por índice se rompería.
  const pasoActual = pasos[paso - 1];

  useEffect(() => () => { if (reenvioRef.current) clearInterval(reenvioRef.current); }, []);

  // Sesión de empleado: este flujo no es para ellos.
  useEffect(() => {
    if (token && tipo === 'empleado') navigate('/dashboard', { replace: true });
  }, [token, tipo, navigate]);

  // Con sesión de cliente: se traen sus vehículos para decidir si hay que pedir uno nuevo.
  useEffect(() => {
    if (!esClienteConSesion) return;
    let vivo = true;
    portalService.getVehiculos()
      .then((lista) => { if (vivo) setVehiculos(lista); })
      .catch(() => { if (vivo) setVehiculos([]); })
      .finally(() => { if (vivo) setCargandoInicial(false); });
    return () => { vivo = false; };
  }, [esClienteConSesion]);

  // Horario real del taller (solo con sesión; si falla quedan los valores por defecto).
  useEffect(() => {
    if (!esClienteConSesion) return;
    let vivo = true;
    portalService.getHorario()
      .then((h) => { if (vivo && h?.apertura) setHorario(h); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [esClienteConSesion]);

  // Técnicos que atienden la fecha elegida, y franjas ya tomadas del que se elija.
  useEffect(() => {
    if (!esClienteConSesion || !cita.Fecha) { setEmpleadosDisp([]); return; }
    let vivo = true;
    portalService.getEmpleadosDisponibles(cita.Fecha)
      .then((l) => { if (vivo) setEmpleadosDisp(l); })
      .catch(() => { if (vivo) setEmpleadosDisp([]); });
    return () => { vivo = false; };
  }, [esClienteConSesion, cita.Fecha]);

  useEffect(() => {
    if (!esClienteConSesion || !cita.Fecha || !cita.Id_Empleado) { setHorasOcupadas([]); return; }
    let vivo = true;
    portalService.getHorasOcupadas(cita.Fecha, cita.Id_Empleado)
      .then((l) => { if (vivo) setHorasOcupadas(l); })
      .catch(() => { if (vivo) setHorasOcupadas([]); });
    return () => { vivo = false; };
  }, [esClienteConSesion, cita.Fecha, cita.Id_Empleado]);

  // Catálogo público de tipos de documento (solo hace falta en el paso de cuenta).
  useEffect(() => {
    if (esClienteConSesion || tiposDoc.length) return;
    let vivo = true;
    registroService.getTiposDocumento()
      .then((l) => { if (vivo) setTiposDoc(l); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [esClienteConSesion, tiposDoc.length]);

  const arrancarCooldown = useCallback(() => {
    setReenvio(REENVIO_COOLDOWN);
    reenvioRef.current = setInterval(() => {
      setReenvio((p) => {
        if (p <= 1) { clearInterval(reenvioRef.current); return 0; }
        return p - 1;
      });
    }, 1000);
  }, []);

  /* ── Validaciones en vivo (mismos validadores compartidos que el resto de la app) ── */
  const errCorreo = tocado.Correo && cuenta.Correo ? validarCorreo(cuenta.Correo, false) : '';
  const passwordDebil = cuenta.Password ? validarPassword(cuenta.Password) : '';
  const errPassword = tocado.Password ? passwordDebil : '';
  const errConfirmar = tocado.ConfirmarPassword && cuenta.ConfirmarPassword
    ? validarConfirmacion(cuenta.ConfirmarPassword, cuenta.Password) : '';

  const cuentaLista = !validarCorreo(cuenta.Correo, false)
    && !validarPassword(cuenta.Password)
    && !validarConfirmacion(cuenta.ConfirmarPassword, cuenta.Password)
    && cuenta.Nombre.trim().length >= 3
    && cuenta.Contacto.trim().length >= 7
    && !!cuenta.Id_TipoDoc
    && cuenta.Documento.trim().length >= 5;

  // Placa con el validador compartido (formato ABC123 carro / ABC12D moto), el mismo que
  // usa el formulario del taller. Antes solo se medía la longitud, así que "XX" o "123456"
  // pasaban y la cita fallaba recién al confirmar.
  const errPlaca = tocado.Placa && vehiculo.Placa ? validarPlaca(vehiculo.Placa) : '';
  const anioValido = /^\d{4}$/.test(String(vehiculo.Anio))
    && Number(vehiculo.Anio) >= 1900
    && Number(vehiculo.Anio) <= new Date().getFullYear() + 1;
  // Fecha+hora futuras. Duplicado a propósito con assertNoEnPasado del backend
  // (agenda.service.js) -- acá es solo feedback inmediato; la autoridad real es la API.
  // Si esa regla cambia allá, hay que tocar también esta copia y la de PortalPage.
  const citaEnPasado = (() => {
    if (!cita.Fecha || !cita.Hora) return false;
    const dt = new Date(`${cita.Fecha}T${cita.Hora}:00`);
    return Number.isNaN(dt.getTime()) || dt.getTime() <= Date.now();
  })();
  const citaLista = !!cita.Fecha && !!cita.Hora && !citaEnPasado
    && (usarNuevoVehiculo || !tieneVehiculos ? true : !!vehiculoElegido);

  const cambiar = (setter) => (e) => { setter((p) => ({ ...p, [e.target.name]: e.target.value })); setError(''); };

  const franjas = useMemo(
    () => horasDisponibles(cita.Fecha, { horario, ocupadas: horasOcupadas }),
    [cita.Fecha, horario, horasOcupadas],
  );

  // Cambiar la fecha (o el técnico) puede invalidar la hora ya elegida: si deja de estar
  // entre las ofrecibles se limpia, para que no quede una selección imposible.
  useEffect(() => {
    if (cita.Hora && !franjas.includes(cita.Hora)) setCita((p) => ({ ...p, Hora: '' }));
  }, [franjas]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiarFecha = (e) => { setCita((p) => ({ ...p, Fecha: e.target.value })); setError(''); };
  const marcarTocado = (e) => setTocado((p) => ({ ...p, [e.target.name]: true }));

  /* ── Paso Cuenta -> Código ── */
  const enviarCuenta = async (e) => {
    e.preventDefault();
    setTocado({ Correo: true, Password: true, ConfirmarPassword: true });
    if (!cuentaLista) { vibrar('Revisa los datos antes de continuar.'); return; }
    setCargando(true);
    try {
      await registroService.registrar(cuenta.Correo, cuenta.Password, cuenta.ConfirmarPassword);
      setCodigo('');
      arrancarCooldown();
      irAPaso(paso + 1);
    } catch (err) {
      vibrar(err?.response?.data?.message || 'No pudimos crear tu cuenta. Intenta de nuevo.');
    } finally { setCargando(false); }
  };

  /* ── Paso Código -> Vehículo ── */
  const enviarCodigo = async (e) => {
    e.preventDefault();
    if (codigo.length !== OTP_LARGO) { vibrar('Escribe los 6 dígitos del código.'); return; }
    setCargando(true);
    try {
      await registroService.verificarCodigo(cuenta.Correo, codigo);
      irAPaso(paso + 1);
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

  /* ── Paso Vehículo -> Cita (sin petición: el vehículo se crea al confirmar) ── */
  const continuarVehiculo = (e) => {
    e.preventDefault();
    setTocado((p) => ({ ...p, Placa: true }));
    // Se muestra el motivo real (formato de placa vs. año) en vez de un genérico.
    const motivo = validarPlaca(vehiculo.Placa)
      || (!anioValido ? 'El año no es válido (4 dígitos, hasta el año próximo).' : '');
    if (motivo) { vibrar(motivo); return; }
    irAPaso(paso + 1);
  };

  /* ══ Confirmación final: los POST secuenciales con una sola animación de carga ══
     Orden obligado: la cuenta primero (da el token), con ese token el vehículo (devuelve
     su Id) y por último la cita, que necesita ese Id. */
  const etapasEnvio = useMemo(() => {
    const e = [];
    if (!esClienteConSesion) e.push('Creando tu cuenta');
    if (!tieneVehiculos || usarNuevoVehiculo) e.push('Registrando tu vehículo');
    e.push('Agendando tu cita');
    return e;
  }, [esClienteConSesion, tieneVehiculos, usarNuevoVehiculo]);

  const confirmar = async (e) => {
    e.preventDefault();
    if (citaEnPasado) { vibrar('La fecha y la hora de la cita deben ser futuras.'); return; }
    if (!citaLista) { vibrar('Elige fecha y hora para tu cita.'); return; }
    setEnviando(true);
    setEtapaEnvio(0);
    setError('');
    // Se recuerda si la cuenta llegó a crearse: si falla un paso POSTERIOR, el usuario ya
    // quedó registrado y con sesión -- no se lo puede dejar en una pantalla muerta.
    let cuentaCreada = false;
    try {
      // 1) Cuenta (solo si es nuevo). Deja la sesión iniciada: el token queda en el store
      //    y en localStorage, así que las dos llamadas siguientes ya van autenticadas.
      if (!esClienteConSesion) {
        const res = await dispatch(completarRegistroThunk({
          Correo: cuenta.Correo,
          Nombre: cuenta.Nombre.trim(),
          Documento: cuenta.Documento.trim(),
          Id_TipoDoc: Number(cuenta.Id_TipoDoc),
          Contacto: cuenta.Contacto.trim(),
        }));
        if (res.error) throw new Error(res.payload || 'No pudimos crear tu cuenta.');
        cuentaCreada = true;
        setEtapaEnvio((n) => n + 1);
      }

      // 2) Vehículo (si no tiene ninguno o pidió registrar otro).
      let idVehiculo = vehiculoElegido;
      if (!tieneVehiculos || usarNuevoVehiculo) {
        const creado = await portalService.crearVehiculo(vehiculo);
        idVehiculo = creado?.Id_Vehiculo;
        if (!idVehiculo) throw new Error('No pudimos registrar tu vehículo.');
        setEtapaEnvio((n) => n + 1);
      }

      // 3) Cita.
      await portalService.crearCita({
        Id_Vehiculo: idVehiculo,
        Fecha: cita.Fecha,
        Hora: cita.Hora,
        TipoCita: cita.TipoCita,
        Descripcion: cita.Descripcion,
        Id_Empleado: cita.Id_Empleado,
      });
      setEtapaEnvio((n) => n + 1);

      navigate('/portal', { replace: true, state: { citaAgendada: true } });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'No pudimos completar el agendamiento.';
      setEnviando(false);
      if (cuentaCreada) {
        // La cuenta ya existe y la sesión está abierta: mandarlo al portal con el motivo,
        // en vez de dejarlo en un formulario que ya no puede reenviar (su correo quedaría
        // tomado y el paso 1 fallaría con "ya existe una cuenta").
        navigate('/portal', { replace: true, state: { agendarError: msg } });
        return;
      }
      vibrar(msg);
    }
  };

  /* ── Render ── */
  if (cargandoInicial) {
    return (
      <div className="flujo-page">
        <div className="flujo-card">
          <CargaUnificada titulo="Cargando tus datos..." etapas={[]} etapaActual={0} />
        </div>
      </div>
    );
  }

  const hoy = todayLocalYMD();

  return (
    <div className="flujo-page">
      <div className="flujo-card flujo-card--ancha">
        <header className="flujo-card__header">
          <Link to="/" className="flujo-volver"><MdArrowBack size={18} /> Volver</Link>
          <div className="flujo-marca">
            <span className="flujo-marca__logo">S</span>
            <span className="flujo-marca__nombre">SIGOT</span>
          </div>
        </header>

        {!enviando && pasos.length > 1 && <BarraProgreso pasos={pasos} paso={paso} />}

        {/* El deslizamiento entre pasos lo resuelve PasoAnimado con un spring de
            Motion y AnimatePresence mode="wait". Antes eran keyframes CSS
            coreografiados con setTimeout en el hook. */}
        <PasoAnimado paso={paso} direccion={direccion} className={claseCuerpo}>
          {/* ════════ Envío final: una sola carga para las 3 peticiones ════════ */}
          {enviando ? (
            <CargaUnificada
              titulo="Estamos agendando tu cita"
              etapas={etapasEnvio}
              etapaActual={etapaEnvio}
            />
          ) : (
            <>
              {/* ════════ CUENTA ════════ */}
              {pasoActual === 'Cuenta' && (
                <form onSubmit={enviarCuenta} noValidate>
                  <h1 className="flujo-titulo">Agenda tu cita</h1>
                  <p className="flujo-sub">
                    Crea tu cuenta y agenda en un solo paso. Para atender tu vehículo necesitamos
                    registrarlo, así que te lo pedimos enseguida.
                  </p>

                  <CampoFlotante
                    id="ag-correo" name="Correo" label="Correo electrónico" type="email"
                    value={cuenta.Correo} onChange={cambiar(setCuenta)} onBlur={marcarTocado}
                    icon={MdEmail} error={errCorreo} autoComplete="email"
                    valido={!!cuenta.Correo && !validarCorreo(cuenta.Correo, false)}
                  />
                  <CampoFlotante
                    id="ag-password" name="Password" label="Contraseña"
                    type={verPassword ? 'text' : 'password'}
                    value={cuenta.Password} onChange={cambiar(setCuenta)} onBlur={marcarTocado}
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
                    id="ag-confirmar" name="ConfirmarPassword" label="Confirmar contraseña"
                    type={verPassword ? 'text' : 'password'}
                    value={cuenta.ConfirmarPassword} onChange={cambiar(setCuenta)} onBlur={marcarTocado}
                    icon={MdLock} error={errConfirmar} autoComplete="new-password"
                    valido={!!cuenta.ConfirmarPassword && !validarConfirmacion(cuenta.ConfirmarPassword, cuenta.Password)}
                  />
                  <CampoFlotante
                    id="ag-nombre" name="Nombre" label="Nombre completo"
                    value={cuenta.Nombre} onChange={cambiar(setCuenta)}
                    icon={MdPerson} autoComplete="name"
                    valido={cuenta.Nombre.trim().length >= 3}
                  />
                  <CampoFlotante
                    id="ag-contacto" name="Contacto" label="Teléfono"
                    value={cuenta.Contacto} onChange={cambiar(setCuenta)}
                    icon={MdPhone} inputMode="tel" autoComplete="tel" maxLength={50}
                    valido={cuenta.Contacto.trim().length >= 7}
                  />
                  <div className="flujo-fila-2">
                    <CampoSelect
                      id="ag-tipodoc" name="Id_TipoDoc" icon={MdBadge}
                      value={cuenta.Id_TipoDoc} onChange={cambiar(setCuenta)}
                      placeholder="Tipo de documento"
                      options={tiposDoc.map((t) => ({ value: t.Id_TipoDoc, label: t.Nombre }))}
                    />
                    <CampoFlotante
                      id="ag-documento" name="Documento" label="Número"
                      value={cuenta.Documento} onChange={cambiar(setCuenta)}
                      icon={MdBadge} inputMode="numeric" maxLength={20}
                      valido={cuenta.Documento.trim().length >= 5}
                    />
                  </div>

                  <p className="flujo-aviso">
                    <MdShield size={15} aria-hidden="true" />
                    Tu documento de identidad es requerido exclusivamente para la asignación legal
                    de tus órdenes de trabajo
                  </p>

                  {error && <p className="flujo-error" role="alert">{error}</p>}
                  <BotonFlujo cargando={cargando}>Continuar</BotonFlujo>
                  <p className="flujo-pie">
                    ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
                  </p>
                </form>
              )}

              {/* ════════ CÓDIGO ════════ */}
              {pasoActual === 'Código' && (
                <form onSubmit={enviarCodigo} noValidate>
                  <h1 className="flujo-titulo">Verifica tu correo</h1>
                  <p className="flujo-sub">
                    Enviamos un código de 6 dígitos a <strong>{cuenta.Correo}</strong>
                  </p>

                  <CodigoOtp
                    valor={codigo}
                    onChange={(v) => { setCodigo(v); setError(''); }}
                    error={!!error} deshabilitado={cargando}
                  />

                  {error && <p className="flujo-error" role="alert">{error}</p>}
                  <BotonFlujo cargando={cargando} disabled={codigo.length !== OTP_LARGO}>
                    Verificar
                  </BotonFlujo>

                  <div className="flujo-reenvio">
                    {reenvio > 0 ? (
                      <span className="flujo-reenvio__espera">Puedes reenviar el código en {reenvio}s</span>
                    ) : (
                      <button type="button" className="flujo-reenvio__btn" onClick={reenviarCodigo} disabled={cargando}>
                        Reenviar código
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* ════════ VEHÍCULO ════════ */}
              {pasoActual === 'Vehículo' && (
                <form onSubmit={continuarVehiculo} noValidate>
                  <h1 className="flujo-titulo">Tu vehículo</h1>
                  <p className="flujo-sub">
                    Para agendar necesitamos el vehículo registrado. Con la placa y el año alcanza.
                  </p>

                  <CampoFlotante
                    id="ag-placa" name="Placa" label="Placa"
                    value={vehiculo.Placa}
                    onChange={(e) => { setVehiculo((p) => ({ ...p, Placa: normalizarPlaca(e.target.value) })); setError(''); }}
                    onBlur={marcarTocado}
                    icon={MdDirectionsCar} maxLength={10}
                    error={errPlaca}
                    valido={!!vehiculo.Placa && !validarPlaca(vehiculo.Placa)}
                  />
                  <div className="flujo-fila-2">
                    <CampoFlotante
                      id="ag-anio" name="Anio" label="Año"
                      value={vehiculo.Anio} onChange={cambiar(setVehiculo)}
                      icon={MdCalendarToday} inputMode="numeric" maxLength={4}
                      valido={anioValido}
                    />
                    <CampoFlotante
                      id="ag-color" name="Color" label="Color (opcional)"
                      value={vehiculo.Color} onChange={cambiar(setVehiculo)}
                      icon={MdPalette} maxLength={30}
                    />
                  </div>

                  {error && <p className="flujo-error" role="alert">{error}</p>}
                  <BotonFlujo cargando={false}>Continuar</BotonFlujo>
                  {tieneVehiculos && (
                    <BotonFlujo
                      type="button" secundario cargando={false}
                      onClick={() => { setUsarNuevoVehiculo(false); setError(''); }}
                    >
                      Usar un vehículo que ya tengo
                    </BotonFlujo>
                  )}
                </form>
              )}

              {/* ════════ CITA ════════ */}
              {pasoActual === 'Cita' && (
                <form onSubmit={confirmar} noValidate>
                  <h1 className="flujo-titulo">Detalles de la cita</h1>
                  <p className="flujo-sub">
                    {cliente?.Nombre ? `${cliente.Nombre}, elige ` : 'Elige '}
                    cuándo traer el vehículo y qué necesitas.
                  </p>

                  {/* Con sesión y vehículos ya registrados: elegir uno (el "un solo paso"). */}
                  {esClienteConSesion && tieneVehiculos && !usarNuevoVehiculo && (
                    <>
                      <CampoSelect
                        id="ag-vehiculo" name="vehiculoElegido" icon={MdDirectionsCar}
                        value={vehiculoElegido}
                        onChange={(e) => { setVehiculoElegido(e.target.value); setError(''); }}
                        placeholder="Elegí tu vehículo"
                        options={vehiculos.map((v) => ({
                          value: v.Id_Vehiculo,
                          label: `${v.Placa}${v.Color ? ` · ${v.Color}` : ''}${v.Anio ? ` · ${v.Anio}` : ''}`,
                        }))}
                      />
                      <BotonFlujo
                        type="button" secundario cargando={false}
                        onClick={() => { setUsarNuevoVehiculo(true); setVehiculoElegido(''); setError(''); }}
                      >
                        Registrar otro vehículo
                      </BotonFlujo>
                    </>
                  )}

                  <div className="flujo-fila-2">
                    <div className="campo">
                      <div className="campo__caja">
                        <MdCalendarToday className="campo__icono" size={19} aria-hidden="true" />
                        <input
                          id="ag-fecha" name="Fecha" type="date"
                          className="campo__input campo__input--select"
                          value={cita.Fecha} min={hoy}
                          onChange={cambiarFecha}
                          aria-label="Fecha de la cita"
                        />
                      </div>
                    </div>
                    <CampoSelect
                      id="ag-hora" name="Hora" icon={MdSchedule}
                      value={cita.Hora} onChange={cambiar(setCita)}
                      placeholder="Hora"
                      options={franjas.map((h) => ({ value: h, label: h }))}
                    />
                  </div>

                  {/* Elección de técnico: solo con sesión, porque empleados-disponibles
                      exige auth. Sin sesión el backend asigna el primero activo (ver
                      portal.controller.js::crearCita). Es opcional en los dos casos. */}
                  {esClienteConSesion && cita.Fecha && empleadosDisp.length > 0 && (
                    <CampoSelect
                      id="ag-empleado" name="Id_Empleado" icon={MdPerson}
                      value={cita.Id_Empleado} onChange={cambiar(setCita)}
                      placeholder="Técnico (sin preferencia)"
                      options={empleadosDisp
                        .filter((e) => e.disponible)
                        .map((e) => ({ value: e.id_empleado, label: e.Nombre }))}
                    />
                  )}

                  <CampoSelect
                    id="ag-tipo" name="TipoCita" icon={MdBuild}
                    value={cita.TipoCita} onChange={cambiar(setCita)}
                    placeholder="Tipo de servicio"
                    options={TIPOS_CITA}
                  />

                  <CampoFlotante
                    id="ag-desc" name="Descripcion" label="¿Qué necesitas? (opcional)"
                    value={cita.Descripcion} onChange={cambiar(setCita)}
                    icon={MdEventNote} maxLength={300}
                  />

                  <p className="flujo-aviso">
                    <MdSchedule size={15} aria-hidden="true" />
                    {cita.Fecha && franjas.length === 0
                      ? `Para hoy ya no quedan horas disponibles (atendemos hasta las ${HORA_CIERRE}:00). Elige otra fecha.`
                      : `Atendemos de ${String(HORA_APERTURA).padStart(2, '0')}:00 a ${HORA_CIERRE}:00. Si la hora que eliges ya está ocupada te lo avisamos al confirmar.`}
                  </p>

                  {error && <p className="flujo-error" role="alert">{error}</p>}
                  <BotonFlujo cargando={false} disabled={!citaLista}>Confirmar cita</BotonFlujo>
                </form>
              )}
            </>
          )}
        </PasoAnimado>
      </div>
    </div>
  );
}
