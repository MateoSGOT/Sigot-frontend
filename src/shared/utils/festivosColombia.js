// Festivos de Colombia (Ley 51 de 1983, "Ley Emiliani"). Réplica en el frontend del
// mismo cálculo que hace el backend (src/utils/festivosColombia.js) para avisar al usuario
// ANTES de enviar (el backend igual valida). Tres grupos: fijos, trasladables al lunes, y
// móviles basados en la Pascua.

// Domingo de Pascua (algoritmo de Butcher/Meeus). Se construye a mediodía local.
const _domingoPascua = (anio) => {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia, 12, 0, 0, 0);
};

const _ymd = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Traslada al lunes siguiente si no cae ya en lunes (getDay(): 0=dom, 1=lun).
const _siguienteLunes = (date) => {
  const d = new Date(date);
  const dow = d.getDay();
  if (dow !== 1) d.setDate(d.getDate() + ((8 - dow) % 7));
  return d;
};

const _sumarDias = (date, dias) => { const d = new Date(date); d.setDate(d.getDate() + dias); return d; };

const _cache = new Map();
export const festivosDelAnio = (anio) => {
  if (_cache.has(anio)) return _cache.get(anio);
  const fechas = [
    new Date(anio, 0, 1, 12),   // Año Nuevo
    new Date(anio, 4, 1, 12),   // Día del Trabajo
    new Date(anio, 6, 20, 12),  // Día de la Independencia
    new Date(anio, 7, 7, 12),   // Batalla de Boyacá
    new Date(anio, 11, 8, 12),  // Inmaculada Concepción
    new Date(anio, 11, 25, 12), // Navidad
    _siguienteLunes(new Date(anio, 0, 6, 12)),   // Reyes Magos
    _siguienteLunes(new Date(anio, 2, 19, 12)),  // San José
    _siguienteLunes(new Date(anio, 5, 29, 12)),  // San Pedro y San Pablo
    _siguienteLunes(new Date(anio, 7, 15, 12)),  // Asunción de la Virgen
    _siguienteLunes(new Date(anio, 9, 12, 12)),  // Día de la Raza
    _siguienteLunes(new Date(anio, 10, 1, 12)),  // Todos los Santos
    _siguienteLunes(new Date(anio, 10, 11, 12)), // Independencia de Cartagena
  ];
  const pascua = _domingoPascua(anio);
  fechas.push(_sumarDias(pascua, -3)); // Jueves Santo
  fechas.push(_sumarDias(pascua, -2)); // Viernes Santo
  fechas.push(_sumarDias(pascua, 43)); // Ascensión del Señor
  fechas.push(_sumarDias(pascua, 64)); // Corpus Christi
  fechas.push(_sumarDias(pascua, 71)); // Sagrado Corazón de Jesús

  const set = new Set(fechas.map(_ymd));
  _cache.set(anio, set);
  return set;
};

// ¿La fecha (YYYY-MM-DD, o ISO recortado) es festivo en Colombia?
export const esFestivo = (ymd) => {
  if (!ymd) return false;
  const s = String(ymd).slice(0, 10);
  const anio = Number(s.slice(0, 4));
  if (!Number.isInteger(anio)) return false;
  return festivosDelAnio(anio).has(s);
};
