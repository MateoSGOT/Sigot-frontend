export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
