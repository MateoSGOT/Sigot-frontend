import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Maneja el paso actual de un flujo multi-paso y la vibración lateral de error.
 * Lo comparten el autoregistro (/registro) y el agendamiento público (/agendar)
 * para que los dos se comporten igual.
 *
 * EL SLIDE YA NO SE COREOGRAFÍA ACÁ. Antes este hook hacía:
 *   setTransicion('saliendo') → setTimeout(220ms) → setPaso(destino)
 *   → setTransicion('entrando') → setTimeout(260ms) → setTransicion(null)
 * y las dos duraciones tenían que coincidir a mano con --flujo-dur-* del CSS,
 * porque si no el contenido se cambiaba antes de terminar de desvanecerse.
 *
 * Eso tenía dos problemas reales, además de la duplicación de duraciones:
 *   · Si el usuario avanzaba dos veces rápido, los temporizadores de la primera
 *     transición seguían vivos y pisaban el estado de la segunda.
 *   · La salida dependía de que el temporizador llegara: cualquier re-render
 *     que desmontara el nodo cortaba la animación a la mitad.
 *
 * Ahora el paso cambia de inmediato y la transición la resuelve
 * <PasoAnimado> con AnimatePresence mode="wait" (ver FlujoProgresivo.jsx): la
 * salida se completa antes de montar la entrada, sin un solo setTimeout.
 *
 * Devuelve:
 *   paso            número de paso actual (base 1)
 *   direccion       1 si se avanzó, -1 si se retrocedió (lo usa PasoAnimado
 *                   para decidir de qué lado entra y hacia dónde sale)
 *   irAPaso(n)      cambia de paso
 *   vibrar(msg)     dispara el shake y deja el mensaje en `error`
 *   error/setError  mensaje de error visible
 *   claseCuerpo     clases CSS del contenedor del paso (ya solo el shake)
 *   programar(f,ms) setTimeout con limpieza al desmontar
 */
export function useFlujoProgresivo(pasoInicial = 1) {
  const [paso, setPaso] = useState(pasoInicial);
  const [direccion, setDireccion] = useState(1);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const temporizadores = useRef([]);

  // Sin esto, un setState despues de desmontar (ej. el usuario navega mientras
  // corre el shake) dispara un warning y deja timers vivos.
  useEffect(() => () => {
    temporizadores.current.forEach(clearTimeout);
    temporizadores.current = [];
  }, []);

  const programar = useCallback((fn, ms) => {
    temporizadores.current.push(setTimeout(fn, ms));
  }, []);

  /* Depende de `paso` a propósito: la dirección se decide comparando el destino
     con el paso actual. Eso da una identidad nueva de la función en cada cambio
     de paso, que acá no cuesta nada -- se pasa a onClick, no a un hijo
     memoizado en un camino caliente. */
  const irAPaso = useCallback((destino) => {
    setError('');
    setDireccion(destino >= paso ? 1 : -1);
    setPaso(destino);
  }, [paso]);

  const vibrar = useCallback((mensaje) => {
    setError(mensaje);
    setShake(true);
    programar(() => setShake(false), 420);
  }, [programar]);

  // Solo el shake: la entrada y la salida las anima Motion.
  const claseCuerpo = `flujo-card__cuerpo${shake ? ' flujo-card__cuerpo--shake' : ''}`;

  return { paso, setPaso, direccion, irAPaso, vibrar, error, setError, claseCuerpo, programar };
}
