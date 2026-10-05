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

   EL HALO YA ESTABA AL 4%. --color-primary-50 es rgba(43,92,255,0.04): cobalto
   al cuatro por ciento, flotando arriba a la derecha. Compuesto sobre el canvas
   da rgb(240,244,252), ocho niveles de diferencia. Estaba, pero apenas.

   LA CUADRÍCULA ES LO QUE FALTABA, y su color NO es el que se pidió. El encargo
   decía slate-200 al 15-20 %. Medido sobre este lienzo:
       slate-200 al 15 %  ->  rgb(245,247,250)    3 niveles de diferencia
       slate-200 al 20 %  ->  rgb(244,246,250)    4 niveles
   Tres o cuatro niveles sobre 248 no se ven en ninguna pantalla: sería una
   cuadrícula que existe en el CSS y no en la imagen. La referencia útil es la
   versión oscura, que usaba blanco al 5 % sobre #0A0A0B y daba 12 niveles.

   Se usa --color-border-light (rgba(10,10,11,0.045)), que compone a
   rgb(237,239,241): 11 niveles, prácticamente esa misma referencia. Y es un
   token del sistema, no un color suelto -- es justamente "la línea más tenue
   sobre superficie clara", que es lo que es una trama de hairlines.

   Para ajustarlo: --color-border da 17 niveles (más marcada); bajar el token,
   menos. El tamaño de celda son 40px, como se pidió.

   UNA SOLA CADENA, SIN CONCATENAR. Tailwind busca candidatos escaneando el
   TEXTO FUENTE: una clase repartida entre dos literales unidos con + no aparece
   entera en el archivo, el escáner no la ve y la utilidad no se genera. El
   build pasa limpio y el fondo sale liso. Ya ocurrió con esta misma trama en su
   versión oscura. De ahí la línea larga. */
const CUADRICULA = 'bg-[repeating-linear-gradient(0deg,var(--color-border-light)_0px,var(--color-border-light)_1px,transparent_1px,transparent_40px),repeating-linear-gradient(90deg,var(--color-border-light)_0px,var(--color-border-light)_1px,transparent_1px,transparent_40px)] [mask-image:radial-gradient(900px_600px_at_50%_30%,#000_20%,transparent_75%)]';

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
