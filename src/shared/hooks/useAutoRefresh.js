import { useEffect, useRef } from 'react';

/**
 * Refresco periódico ACOTADO — se usa solo en pantallas clave (Agenda, Órdenes y el
 * portal del cliente), no de forma global. Diseñado para NO molestar al usuario:
 *  - No dispara mientras la pestaña está oculta (document.hidden) → no gasta red en vano.
 *  - `enabled` lo pausa mientras hay un modal/formulario abierto, para no interrumpir ni
 *    reiniciar lo que se está escribiendo.
 *  - Usa una ref para el callback: cambiar la función en cada render no reinicia el timer.
 *
 * @param {Function} callback   Qué refrescar (p. ej. () => dispatch(fetchAgenda())).
 * @param {Object}   opts
 * @param {number}   [opts.intervalMs=20000]  Cada cuánto refrescar.
 * @param {boolean}  [opts.enabled=true]       Falso = pausado (modal/form abierto).
 */
export function useAutoRefresh(callback, { intervalMs = 20000, enabled = true } = {}) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => { if (!document.hidden) cbRef.current?.(); };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
}

export default useAutoRefresh;
