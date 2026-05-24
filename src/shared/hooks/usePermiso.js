import { useSelector } from 'react-redux';

export const usePermiso = (permiso) => {
  const permisos = useSelector(s => s.auth.permisos);
  if (!permisos) return true; // loading state — don't block
  return permisos.includes(permiso);
};
