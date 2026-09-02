export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const s = String(dateStr);
  // Una fecha "YYYY-MM-DD" (o ISO) se debe leer en horario LOCAL. Con
  // `new Date('2026-08-28')` JS asume UTC medianoche y, al mostrarla en
  // Colombia (UTC-5), se corría un día atrás (aparecía 27 en vez de 28).
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Fecha de hoy como 'YYYY-MM-DD' en horario LOCAL. NUNCA usar
// `new Date().toISOString().split('T')[0]` para esto: toISOString() convierte
// a UTC, y en Colombia (UTC-5) después de las 7pm ya cambió de día ahí,
// haciendo que "hoy" deje de coincidir con la fecha local real (rompe validaciones
// de fecha mínima y filtros de "es hoy" justo en las últimas horas del día).
export const todayLocalYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatCurrency = (value) => {
  if (value == null) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
};

export const getErrorMessage = (error) => {
  return error?.response?.data?.message || error?.message || 'Ha ocurrido un error inesperado';
};

// Ordena por fecha de creación (o el campo ID como respaldo, ya que es autoincremental)
// descendente, para que el registro recién creado aparezca primero. Combínalo con
// sortByStatus pasándole el resultado de esta función: el orden "nuevo primero" se
// conserva dentro del grupo de activos/inactivos porque sortByStatus solo filtra.
export const sortNewestFirst = (items, idField = 'id') => {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const aDate = a?.createdAt ? new Date(a.createdAt).getTime() : null;
    const bDate = b?.createdAt ? new Date(b.createdAt).getTime() : null;
    if (aDate != null && bDate != null && aDate !== bDate) return bDate - aDate;
    return Number(b?.[idField] ?? 0) - Number(a?.[idField] ?? 0);
  });
};

export const sortByStatus = (items) => {
  if (!Array.isArray(items)) return [];
  const active = items.filter((i) => i.Estado === 1 || i.Estado === undefined);
  const inactive = items.filter((i) => i.Estado === 0);
  return [...active, ...inactive];
};

export const filterItems = (items, search, fields) => {
  if (!search) return items;
  const q = search.toLowerCase();
  return items.filter((item) =>
    fields.some((field) => String(item[field] ?? '').toLowerCase().includes(q))
  );
};
