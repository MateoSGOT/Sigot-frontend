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

/* ── Lienzo inmersivo ──
   Tres capas, en orden de pintado: el canvas base, el halo cobalto y la
   cuadrícula. Las dos últimas son lo que evita que el fondo se lea como un
   blanco plano infinito.

   EL CANVAS YA ERA slate-50. --color-bg vale #F8FAFC, que es exactamente el
   slate-50 de Tailwind. No hubo nada que cambiar ahí.

   EL HALO YA ESTABA, arriba a la derecha. Ojo con su opacidad: el token declara
   rgba(43,92,255,0.04), pero el bloque @supports de color-mix lo redefine como
   color-mix(in oklab, var(--color-primary) 5%, transparent), y esa es la rama
   que toma cualquier navegador actual. Medido en pantalla: el color efectivo es
   oklab(... / 0.05) y compone a rgb(238,242,252), diez niveles de diferencia.
   O sea 5%, no 4% -- un punto por encima de lo pedido. No se toca el token
   porque lo comparte OrdenesPage (bg-primary-50); si se quiere exactamente 4%,
   hay que bajar el 5% de esa linea de variables.css y revisar esa otra vista.

   LA CUADRÍCULA: 17 NIVELES SOBRE EL CANVAS. Medido componiendo cada candidato
   sobre --color-bg (#F8FAFC = slate-50) y midiendo la diferencia en niveles de
   0-255:
       --color-border-light 4.5 %  ->  rgb(237,239,241)   11 niveles  (lo anterior)
       --color-border       7 %    ->  rgb(231,233,235)   17 niveles  (lo actual)
       --color-border-strong 16 %  ->  rgb(210,212,213)   39 niveles
       slate-200 al 35 %           ->  rgb(240,244,248)    8 niveles
       slate-200 al 40 %           ->  rgb(239,243,247)    9 niveles
       zinc-200 al 40 %            ->  rgb(240,241,244)    9 niveles

   OJO CON slate-200 / zinc-200: dan MENOS contraste que lo que ya había, no
   más. slate-200 es (226,232,240), un gris ya muy claro, y diluirlo al 35-40 %
   contra un canvas de (248,250,252) apenas lo mueve. La intuición de "un gris
   visible de Tailwind" falla aquí porque el canvas también es casi blanco: lo
   que marca la diferencia es la OPACIDAD de una tinta oscura, no el nombre del
   gris.

   Se usa --color-border, que es un token del sistema (la auditoría de paleta
   rechaza colores sueltos) y sube de 11 a 17 niveles. Para subir más, el
   siguiente escalón es --color-border-strong con 39 niveles: es un cambio de
   una palabra en esta misma constante.

   Referencia: la versión oscura usaba blanco al 5 % sobre #0A0A0B, que son 12
   niveles -- así que 17 ya está por encima de la trama que sí se veía.

   UNA SOLA CADENA, SIN CONCATENAR. Tailwind busca candidatos escaneando el
   TEXTO FUENTE: una clase repartida entre dos literales unidos con + no aparece
   entera en el archivo, el escáner no la ve y la utilidad no se genera. El
   build pasa limpio y el fondo sale liso. Ya ocurrió con esta misma trama en su
   versión oscura. De ahí la línea larga. */
const CUADRICULA = 'bg-[repeating-linear-gradient(0deg,var(--color-border)_0px,var(--color-border)_1px,transparent_1px,transparent_40px),repeating-linear-gradient(90deg,var(--color-border)_0px,var(--color-border)_1px,transparent_1px,transparent_40px)] [mask-image:radial-gradient(900px_600px_at_50%_30%,#000_20%,transparent_75%)]';

const HALO = 'bg-[radial-gradient(1200px_600px_at_100%_-10%,var(--color-primary-50),transparent_62%)]';

/* items-center, no items-start: la tarjeta de ResetPassword cuelga DIRECTAMENTE
   de este contenedor y depende de él para centrarse en vertical. LoginPage no
   se ve afectado porque mete su propio envoltorio con min-h-dvh y
   justify-center, que ocupa todo el alto igual. */
export const AUTH_PAGINA = `flex min-h-dvh items-center justify-center bg-bg px-lg py-2xl ${HALO}`;

/* La trama va en capa FIJA y propia, no en el mismo elemento, por dos razones:
   una máscara sobre un elemento CON contenido obliga al navegador a componer
   todo el subárbol en cada cuadro, y en position:fixed no se repinta al
   desplazarse.

   z-0 y NO -z-10. En el orden de pintado, los hijos con z-index NEGATIVO van en
   el paso 2 y los fondos de los descendientes de bloque en flujo en el paso 3:
   el bg-bg del contenedor taparía la trama. Eso pasó tal cual con la versión
   oscura -- el gradiente, la máscara y la utilidad estaban todos bien y no se
   veía nada. El contenido va en z-10 por delante (AUTH_CONTENIDO). */
export const AUTH_CAPA_CUADRICULA = `pointer-events-none fixed inset-0 z-0 ${CUADRICULA}`;

/* El contenido, por delante de la trama. */
export const AUTH_CONTENIDO = 'relative z-10';

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
