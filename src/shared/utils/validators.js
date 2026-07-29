// Validadores reutilizables para formularios.
// Convención: cada validador devuelve un mensaje de error (string) o '' si es válido.

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_SOLO_DIGITOS = /^\d+$/;

export const isBlank = (v) => v == null || String(v).trim() === '';

export const required = (v, label = 'Este campo') =>
  isBlank(v) ? `${label} es obligatorio.` : '';

// Documento de identidad colombiano: solo dígitos, 6 a 10.
export const documento = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return 'El documento es obligatorio.';
  if (!RE_SOLO_DIGITOS.test(s)) return 'El documento solo puede contener números.';
  if (s.length < 6 || s.length > 10) return 'El documento debe tener entre 6 y 10 dígitos.';
  return '';
};

export const nombre = (v, min = 3) => {
  const s = String(v ?? '').trim();
  if (!s) return 'El nombre es obligatorio.';
  if (s.length < min) return `El nombre debe tener al menos ${min} caracteres.`;
  return '';
};

// Teléfono colombiano: solo dígitos, 7 a 10.
export const telefono = (v, opcional = false) => {
  const s = String(v ?? '').trim();
  if (!s) return opcional ? '' : 'El teléfono es obligatorio.';
  if (!RE_SOLO_DIGITOS.test(s)) return 'El teléfono solo puede contener números.';
  if (s.length < 7 || s.length > 10) return 'El teléfono debe tener entre 7 y 10 dígitos.';
  return '';
};

export const correo = (v, opcional = true) => {
  const s = String(v ?? '').trim();
  if (!s) return opcional ? '' : 'El correo es obligatorio.';
  return RE_EMAIL.test(s) ? '' : 'Ingresa un correo válido.';
};

// Contraseña: mínimo 8, al menos una letra y un número.
export const passwordFuerte = (v) => {
  const s = String(v ?? '');
  if (!s) return 'La contraseña es obligatoria.';
  if (s.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) return 'La contraseña debe incluir al menos una letra y un número.';
  return '';
};

export const confirmarPassword = (v, original) => {
  if (isBlank(v)) return 'Confirma la contraseña.';
  return v !== original ? 'Las contraseñas no coinciden.' : '';
};

export const requiredSelect = (v, label = 'Este campo') =>
  isBlank(v) ? `${label} es obligatorio.` : '';

// Número > 0 (precios).
export const numeroPositivo = (v, label = 'El valor') => {
  if (isBlank(v)) return `${label} es obligatorio.`;
  const n = Number(v);
  if (Number.isNaN(n)) return `${label} debe ser un número.`;
  if (n <= 0) return `${label} debe ser mayor a 0.`;
  return '';
};

// Entero >= 0 (stock).
export const enteroNoNegativo = (v, label = 'El valor') => {
  if (isBlank(v)) return `${label} es obligatorio.`;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) return `${label} debe ser un número entero mayor o igual a 0.`;
  return '';
};

// Año entre 1900 y el próximo.
export const anioVehiculo = (v) => {
  if (isBlank(v)) return 'El año es obligatorio.';
  const n = Number(v);
  const max = new Date().getFullYear() + 1;
  if (!Number.isInteger(n)) return 'El año debe ser un número.';
  if (n < 1900 || n > max) return `El año debe estar entre 1900 y ${max}.`;
  return '';
};

/**
 * Ejecuta un mapa { campo: validadorFn } sobre los valores y devuelve
 * { campo: mensaje } solo con los que tienen error. El validador recibe
 * (valor, valoresCompletos) para permitir validaciones cruzadas.
 */
export const validateForm = (values, rules) => {
  const errors = {};
  for (const [field, validate] of Object.entries(rules)) {
    const msg = validate(values[field], values);
    if (msg) errors[field] = msg;
  }
  return errors;
};

export const hasErrors = (errors) => Object.values(errors).some(Boolean);
