import React, { useRef } from 'react';
import { MdCheck } from 'react-icons/md';
import './flujo-progresivo.css';

/* Piezas compartidas por los flujos multi-paso (autoregistro y agendamiento público).
   Viven juntas para que la transición, la barra de progreso y los campos se vean y se
   comporten igual en los dos; la lógica de pasos está en useFlujoProgresivo.js. */

const OTP_LARGO = 6;

/* ─── Barra de progreso líquida + bolitas de cada paso ─── */
export function BarraProgreso({ pasos, paso }) {
  const total = pasos.length;
  return (
    <div className="flujo-progreso" role="group" aria-label={`Paso ${paso} de ${total}`}>
      <div
        className="flujo-progreso__riel"
        /* El riel va de centro a centro de las bolitas extremas; con N pasos repartidos
           en N columnas iguales, cada centro queda a 1/(2N) de cada borde. */
        style={{ marginLeft: `${50 / total}%`, marginRight: `${50 / total}%` }}
      >
        <div
          className="flujo-progreso__relleno"
          style={{ width: total > 1 ? `${((paso - 1) / (total - 1)) * 100}%` : '100%' }}
        />
      </div>
      <ol className="flujo-progreso__pasos">
        {pasos.map((nombre, i) => {
          const numero = i + 1;
          const completo = numero < paso;
          const activo = numero === paso;
          return (
            <li
              key={nombre}
              className={`flujo-paso${completo ? ' flujo-paso--completo' : ''}${activo ? ' flujo-paso--activo' : ''}`}
              aria-current={activo ? 'step' : undefined}
            >
              <span className="flujo-paso__bolita" aria-hidden="true">
                {completo ? <MdCheck size={15} /> : numero}
              </span>
              <span className="flujo-paso__nombre">{nombre}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ─── Input con label flotante, check de validez y estado de error ─── */
export function CampoFlotante({
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

/* ─── Select con el mismo marco que CampoFlotante (sin label flotante: un <select> no
       tiene :placeholder-shown, así que la primera opción hace de placeholder) ─── */
export function CampoSelect({ id, name, value, onChange, icon: Icon, placeholder, error, options, children }) {
  return (
    <div className={`campo${error ? ' campo--error' : ''}`}>
      <div className="campo__caja">
        {Icon && <Icon className="campo__icono" size={19} aria-hidden="true" />}
        <select
          id={id} name={name}
          className="campo__input campo__input--select"
          value={value} onChange={onChange}
          aria-invalid={!!error}
        >
          <option value="">{placeholder}</option>
          {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          {children}
        </select>
        {!!value && !error && <MdCheck className="campo__check" size={18} aria-hidden="true" />}
      </div>
      {error && <span className="campo__msg-error" role="alert">{error}</span>}
    </div>
  );
}

/* ─── 6 inputs de un dígito con foco secuencial ─── */
export function CodigoOtp({ valor, onChange, error, deshabilitado }) {
  const refs = useRef([]);

  const setDigito = (i, digito) => {
    const siguiente = valor.split('');
    siguiente[i] = digito;
    onChange(siguiente.join('').slice(0, OTP_LARGO));
  };

  const handleChange = (i) => (e) => {
    const limpio = e.target.value.replace(/\D/g, '');
    if (!limpio) { setDigito(i, ''); return; }
    // Pegar el código completo desde el correo: se reparte en todas las casillas en vez
    // de meter 6 dígitos en la primera.
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

/* ─── Botón principal con spinner y botón desvanecido mientras espera la API ─── */
// OJO con el orden: `disabled` y `type` se desestructuran FUERA de ...resto. Si quedaran
// dentro, el spread los reaplicaría DESPUÉS y un `disabled={false}` explícito pisaría el
// bloqueo por `cargando` -- el botón seguiría clickeable durante la petición y se podría
// enviar dos veces.
export function BotonFlujo({ cargando, children, secundario, disabled, type, ...resto }) {
  return (
    <button
      type={type || 'submit'}
      className={`flujo-btn${secundario ? ' flujo-btn--secundario' : ''}${cargando ? ' flujo-btn--cargando' : ''}`}
      disabled={cargando || disabled}
      {...resto}
    >
      {cargando ? <span className="flujo-spinner" aria-hidden="true" /> : children}
    </button>
  );
}

/* ─── Carga unificada del envío final: una sola animación para varias peticiones
       secuenciales, mostrando en qué etapa va. ─── */
export function CargaUnificada({ titulo, etapas, etapaActual }) {
  return (
    <div className="flujo-carga" role="status" aria-live="polite">
      <span className="flujo-carga__spinner" aria-hidden="true" />
      <p className="flujo-carga__titulo">{titulo}</p>
      <ol className="flujo-carga__etapas">
        {etapas.map((texto, i) => {
          const hecha = i < etapaActual;
          const activa = i === etapaActual;
          return (
            <li
              key={texto}
              className={`flujo-carga__etapa${activa ? ' flujo-carga__etapa--activa' : ''}${hecha ? ' flujo-carga__etapa--hecha' : ''}`}
            >
              {hecha ? <MdCheck size={16} aria-hidden="true" /> : <span style={{ width: 16 }} aria-hidden="true" />}
              {texto}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
