import { useState, useRef, useEffect, useCallback } from 'react';

// Duraciones del slide. Deben coincidir con --flujo-dur-salida / --flujo-dur-entrada en
// flujo-progresivo.css: el swap de contenido lo coordina este hook con setTimeout, así que
// si se cambia una hay que cambiar la otra o el contenido salta antes de desvanecerse.
export const DUR_SALIDA = 220;
export const DUR_ENTRADA = 260;

// Las animaciones se saltan por completo si el sistema pide menos movimiento. Mismo
// criterio que CountUp y LandingPage.
export const sinMovimiento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Maneja el paso actual de un flujo multi-paso, la transición de slide horizontal entre
 * pasos y la vibración lateral de error. Lo comparten el autoregistro y el agendamiento
 * público para que la transición sea idéntica en los dos.
 *
 * Devuelve:
 *   paso            número de paso actual (base 1)
 *   irAPaso(n)      avanza/retrocede con la animación
 *   vibrar(msg)     dispara el shake y deja el mensaje en `error`
 *   error/setError  mensaje de error visible
 *   claseCuerpo     clases CSS a poner en el contenedor del paso
 */
export function useFlujoProgresivo(pasoInicial = 1) {
  const [paso, setPaso] = useState(pasoInicial);
  const [transicion, setTransicion] = useState(null); // 'saliendo' | 'entrando' | null
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const temporizadores = useRef([]);

  // Sin esto, un setState despues de desmontar (ej. el usuario navega durante el slide)
  // dispara un warning y deja timers vivos.
  useEffect(() => () => {
    temporizadores.current.forEach(clearTimeout);
    temporizadores.current = [];
  }, []);

  const programar = useCallback((fn, ms) => {
    temporizadores.current.push(setTimeout(fn, ms));
  }, []);

  const irAPaso = useCallback((destino) => {
    setError('');
    if (sinMovimiento()) { setPaso(destino); return; }
    setTransicion('saliendo');
    programar(() => {
      setPaso(destino);
      setTransicion('entrando');
      programar(() => setTransicion(null), DUR_ENTRADA);
    }, DUR_SALIDA);
  }, [programar]);

  const vibrar = useCallback((mensaje) => {
    setError(mensaje);
    setShake(true);
    programar(() => setShake(false), 420);
  }, [programar]);

  const claseCuerpo = `flujo-card__cuerpo${transicion ? ` flujo-card__cuerpo--${transicion}` : ''}${shake ? ' flujo-card__cuerpo--shake' : ''}`;

  return { paso, setPaso, irAPaso, vibrar, error, setError, claseCuerpo, programar };
}
