import { useState, useCallback } from 'react';
import { useToast } from '../components/Toast/ToastContext.jsx';

// Orquesta el flujo de BORRADO REAL contra un service con getDependencias(id) y
// eliminar(id, confirmacion). Alimenta al componente <EliminarRealModal/>.
//   open(id)   → abre el modal y carga la vista previa de dependencias.
//   confirm(t) → ejecuta el borrado con el texto de confirmación.
export function useBorradoReal(service, { entidadLabel = 'registro', onDeleted } = {}) {
  const { addToast } = useToast();
  const [targetId, setTargetId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const open = useCallback(async (id) => {
    setTargetId(id);
    setPreview(null);
    setError('');
    setLoadingPreview(true);
    try {
      const data = await service.getDependencias(id);
      setPreview(data);
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudieron cargar las dependencias.');
    } finally {
      setLoadingPreview(false);
    }
  }, [service]);

  const close = useCallback(() => {
    setTargetId(null);
    setPreview(null);
    setError('');
    setDeleting(false);
  }, []);

  const confirm = useCallback(async (texto) => {
    if (targetId == null) return;
    setDeleting(true);
    setError('');
    try {
      await service.eliminar(targetId, texto);
      const label = entidadLabel.charAt(0).toUpperCase() + entidadLabel.slice(1);
      addToast({ type: 'success', message: `${label} eliminado correctamente.` });
      close();
      onDeleted?.();
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo eliminar.');
      setDeleting(false);
    }
  }, [targetId, service, entidadLabel, addToast, onDeleted, close]);

  return { isOpen: targetId != null, preview, loadingPreview, deleting, error, open, close, confirm };
}
