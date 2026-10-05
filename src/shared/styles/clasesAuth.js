/* ═══════════════════════════════════════════════════════════════════════════
   SUPERFICIE DE LAS PANTALLAS DE ACCESO — clases compartidas.

   POR QUE ES UN MODULO Y NO DOS COPIAS
   Login y ResetPassword son pantallas hermanas: un usuario las ve con minutos
   de diferencia y tienen que ser la misma superficie. Cuando ese vocabulario
   vive duplicado, diverge -- ya paso con los 16 selectores del detalle de
   orden, con .empty-list y con .novedad-warning. Aqui hay un solo literal.

   POR QUE ES CLARA
   Hubo una version oscura (lienzo negro, cuadricula al 5% y halo cobalto). Se
   revirtio: dejaba /login y /reset en oscuro mientras /registro,
   /cambiar-password y toda la aplicacion seguian claros, y el salto se notaba
   justo al pulsar "Registrate aqui" desde el propio login. La coherencia del
   flujo pesa mas que el efecto de una sola pantalla.

   Lo que SI se conservo de aquel trabajo: el boton de Google, el muelle
   compartido k250/c30 y la costumbre de medir el contraste antes de dar por
   buena una combinacion.

   CONTRASTE (calculado sobre los tokens, no estimado):
     titulo  --color-text          19.79:1
     apoyo   --color-text-muted     7.58:1
     tenue   --color-text-light     4.76:1
     enlace  --color-primary-soft-on 7.55:1
     boton   cobalto + blanco       5.15:1
   ═══════════════════════════════════════════════════════════════════════════ */

/* Lienzo: el canvas de la app mas un halo frio arriba a la derecha, el mismo
   que --bg-app. Es el unico adorno; sin el, el fondo plano se ve vacio. */
/* items-center, no items-start: la tarjeta de ResetPassword cuelga DIRECTAMENTE
   de este contenedor y depende de el para centrarse en vertical. LoginPage no
   se ve afectado porque mete su propio envoltorio con min-h-dvh y
   justify-center, que ocupa todo el alto igual. */
export const AUTH_PAGINA = 'flex min-h-dvh items-center justify-center bg-bg px-lg py-2xl '
  + 'bg-[radial-gradient(1200px_600px_at_100%_-10%,var(--color-primary-50),transparent_62%)]';

export const AUTH_TARJETA = 'w-full max-w-[26rem] rounded-lg border border-border bg-surface p-2xl shadow-md';

/* 19.79:1 — texto principal. */
export const AUTH_TITULO = 'font-display text-h1 font-extrabold tracking-tight text-text';
/* 7.58:1 — texto secundario. */
export const AUTH_APOYO = 'text-body leading-normal text-text-muted';
/* 4.76:1 — el piso. Solo adornos junto a un elemento ya etiquetado. */
export const AUTH_TENUE = 'text-text-light';
/* 7.58:1 — todo lo que se pulsa. Un control en el piso de AA se lee como texto
   apagado en vez de como algo accionable. */
export const AUTH_TENUE_ACCION = 'text-text-muted';

/* El campo, en dos variantes.

   El padding derecho va SEPARADO y no encadenado: pr-md y pr-[2.75rem] declaran
   la misma propiedad, y entre dos utilidades de Tailwind no decide el orden en
   que se escriben en el className sino el orden en que salen en el CSS
   generado. Encadenarlas da un resultado que parece correcto hasta que Tailwind
   reordena. Por eso hay una base sin padding-right y dos constantes completas. */
const CAMPO_BASE = 'w-full rounded-md border border-border bg-input-bg py-md pl-[2.75rem] '
  + 'text-body text-text placeholder:text-text-disabled outline-none '
  + 'transition-[border-color,box-shadow] duration-150 '
  + 'focus-visible:border-focus focus-visible:shadow-[0_0_0_3px_var(--color-focus-ring)]';

/* Campo normal. */
export const AUTH_CAMPO = `${CAMPO_BASE} pr-md`;
/* Campo con un control a la derecha (el ojo de mostrar contrasena). */
export const AUTH_CAMPO_ACCION = `${CAMPO_BASE} pr-[2.75rem]`;

export const AUTH_ETIQUETA = 'block text-caption font-semibold uppercase tracking-wide text-text-light';
