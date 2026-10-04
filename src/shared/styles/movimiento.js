/* ═══════════════════════════════════════════════════════════════════════════
   MUELLES COMPARTIDOS DE MOTION

   El rebote de un spring NO lo gobierna `damping` por sí solo, sino la razón de
   amortiguamiento:

       ζ = damping / (2 · √(stiffness · mass))

       ζ < 1   subamortiguado → rebota
       ζ ≈ 1   crítico → se detiene en seco, lo más rápido posible sin pasarse
       ζ > 1   sobreamortiguado → sin rebote, pero se arrastra

   Por eso bajar la rigidez y subir la amortiguación a la vez no es redundante:
   las dos empujan ζ hacia arriba.

   Esto vive en un módulo porque los parámetros estaban escritos a mano en tres
   archivos (el flujo de pasos, el modal y el login) con TRES valores distintos.
   El movimiento es parte de la identidad igual que el color: tres muelles
   distintos se sienten como tres aplicaciones. Y es el mismo problema de
   divergencia que ya costó caro con los cuatro rojos y con orden-detalle.css.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Muelle estándar de la interfaz. Calibrado:
     k=380 c=34 m=0.85   ζ = 0.946   rebotaba
     k=200 c=25 m=0.85   ζ = 0.959   seguiría rebotando
     k=250 c=30 m=0.85   ζ = 1.029   crítico, sin rebote   ← este
   Asentamiento ~0.23 s: se lee como instantáneo y no oscila. */
export const RESORTE = { type: 'spring', stiffness: 250, damping: 30, mass: 0.85 };

/* Revelado al entrar en viewport, para secciones comerciales.
   `once: true` evita que la sección se vuelva a animar al subir y bajar — una
   tarjeta que reaparece cada vez que pasa por pantalla marea y además fuerza
   trabajo de composición en cada scroll.
   `amount: 0.2` dispara cuando hay un quinto del bloque visible: con el valor
   por defecto (0) una tarjeta alta se anima antes de que se vea nada de ella. */
export const AL_ENTRAR = { once: true, amount: 0.2 };

/* Variantes del revelado. Solo opacity y transform: las dos propiedades que el
   compositor resuelve sin repintar. Un `y` de 24px es suficiente para que el
   movimiento se perciba sin que el texto "salte" de lejos. */
export const REVELADO = {
  oculto:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

/* Escalona la entrada de una rejilla de tarjetas. Un retardo por índice en vez
   de un `staggerChildren` del contenedor porque las tarjetas se revelan por
   viewport de forma independiente, no todas a la vez.
   Tope en 6 posiciones: con rejillas largas, un retardo lineal deja la última
   tarjeta entrando casi un segundo después y se siente lento, no elegante. */
export const retardo = (i, paso = 0.06) => ({ delay: Math.min(i, 6) * paso });
