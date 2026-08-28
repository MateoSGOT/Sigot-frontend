import { useEffect, useRef } from 'react';

// Vuelve a llamar `callback` cada `intervalMs` mientras `enabled` sea true.
// No llama inmediatamente (el primer fetch ya lo hace el useEffect de montaje
// de cada página) — solo mantiene los datos frescos sin que el usuario tenga
// que refrescar la página a mano. Se debe pasar `enabled: false` mientras haya
// un modal/formulario abierto, para no interrumpir al usuario a mitad de una
// edición.
export function useAutoRefresh(callback, { intervalMs = 20000, enabled = true } = {}) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => savedCallback.current(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
}
