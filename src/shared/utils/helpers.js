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
