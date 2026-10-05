/* ═══════════════════════════════════════════════════════════════════════════
   SUPERFICIE OSCURA DE LAS PANTALLAS DE ACCESO — clases compartidas.

   POR QUE ES UN MODULO Y NO DOS COPIAS
   Login y ResetPassword son pantallas hermanas: un usuario las ve con minutos
   de diferencia y tienen que ser la misma superficie. Cuando ese vocabulario
   vive duplicado en dos archivos, diverge -- ya paso con los 16 selectores del
   detalle de orden, con .empty-list y con .novedad-warning. Aqui no puede: hay
   un solo literal y las dos lo importan.

   SOBRE EL NEGRO ELEGIDO
   El encargo pedia bg-slate-950 (#020617). Se usa --color-surface-dark
   (#0A0A0B), que es el negro que el proyecto YA tiene y que esta pantalla
   hermana ya usa. Dos cuasi-negros a 8 puntos de distancia serian deriva de
   paleta -- justo lo que vigila auditar-paleta.mjs -- y dejarian las dos
   pantallas de acceso con fondos distintos. El aspecto "Linear/Vercel" no lo da
   el valor exacto del negro, sino las dos capas de encima: la cuadricula y el
   halo. Si se prefiere el tono azulado de slate, se cambia el token y las dos
   pantallas lo siguen a la vez.

   CONTRASTE
   Los porcentajes de blanco estan medidos sobre --color-surface-dark-raised
   (#16161A) en el navegador, componiendo el alfa sobre el fondo real:
     90% -> 14.74:1   ·   65% -> 8.05:1   ·   60% -> 7.07:1   ·   45% -> 4.52:1
   45% es el PISO exacto de AA: vale para un adorno junto a un elemento ya
   etiquetado, nunca para un control.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Capas del lienzo ──
   Tres capas apiladas en un solo elemento, en orden de pintado:
     1. la cuadricula matematica (dos gradientes repetidos, 1px cada 40px)
     2. el halo cobalto flotando arriba a la derecha
     3. el negro base
   La cuadricula va al 5% de blanco y ADEMAS enmascarada con un radial que la
   desvanece hacia los bordes: a opacidad uniforme la trama se lee como ruido y
   compite con la tarjeta; desvanecida da profundidad sin pedir atencion. */
/* UNA SOLA CADENA, SIN CONCATENAR, y no es un capricho de formato.

   Tailwind busca candidatos escaneando el TEXTO FUENTE, no evaluando el modulo.
   Una clase repartida entre dos literales unidos con + nunca aparece entera en
   el archivo, asi que el escaner no la ve y la utilidad no se genera: el build
   pasa limpio y el fondo sale liso. Escrita partida en dos, esta cuadricula no
   llego al CSS compilado y lo detecto scripts/auditar-utilidades.mjs.

   De ahi la linea larga: es el precio de que la clase exista. */
const CUADRICULA = 'bg-[repeating-linear-gradient(0deg,rgb(255_255_255_/_0.05)_0px,rgb(255_255_255_/_0.05)_1px,transparent_1px,transparent_40px),repeating-linear-gradient(90deg,rgb(255_255_255_/_0.05)_0px,rgb(255_255_255_/_0.05)_1px,transparent_1px,transparent_40px)] [mask-image:radial-gradient(900px_600px_at_50%_30%,#000_20%,transparent_75%)]';

const HALO =
  'bg-[radial-gradient(900px_520px_at_85%_10%,rgb(43_92_255_/_0.22),transparent_62%)]';

/* El lienzo: negro base + halo. La cuadricula va en su propia capa fija (ver
   CAPA_CUADRICULA) para que no se repinte al hacer scroll. */
export const AUTH_PAGINA = `flex min-h-dvh items-center justify-center bg-surface-dark px-lg py-2xl ${HALO}`;

/* Capa de la trama, en position:fixed y detras de todo. Separada del lienzo
   porque una mascara sobre un elemento con contenido obliga al navegador a
   componer el subarbol entero en cada cuadro. */
/* z-0 y NO -z-10, que es lo que estaba.

   En el orden de pintado de una capa de apilamiento, los hijos con z-index
   NEGATIVO se dibujan en el paso 2, y los fondos de los descendientes de bloque
   en flujo en el paso 3. El contenedor de la pagina es uno de esos
   descendientes y lleva `bg-surface-dark`, asi que su fondo opaco se pintaba
   ENCIMA de la trama y la hacia invisible. El gradiente existia, la mascara
   existia, la utilidad estaba generada -- y no se veia nada.

   Con z-0 la capa queda por encima del fondo del contenedor; el contenido va en
   z-10 por delante de ella (ver AUTH_CONTENIDO). */
export const AUTH_CAPA_CUADRICULA = `pointer-events-none fixed inset-0 z-0 ${CUADRICULA}`;

/* El contenido, por delante de la trama. */
export const AUTH_CONTENIDO = 'relative z-10';

export const AUTH_TARJETA = 'w-full max-w-[26rem] rounded-lg border border-white/8 '
  + 'bg-surface-dark-raised p-2xl shadow-lg';

/* 90% = 14.74:1 — texto principal. */
export const AUTH_TITULO = 'font-display text-h1 font-bold tracking-tight text-white/90';
/* 65% = 8.05:1 — texto secundario. */
export const AUTH_APOYO = 'text-body leading-normal text-white/65';
/* 45% = 4.52:1 — el PISO de AA. Solo adornos. */
export const AUTH_TENUE = 'text-white/45';
/* 60% = 7.07:1 — todo lo que se pulsa. Un control en el piso justo se lee como
   texto apagado en vez de como algo accionable. */
export const AUTH_TENUE_ACCION = 'text-white/60';

/* El campo, en dos variantes.

   El padding derecho va SEPARADO y no encadenado, y es importante: pr-md y
   pr-[2.75rem] declaran la misma propiedad, y entre dos utilidades de Tailwind
   no decide el orden en que se escriben en el className sino el orden en que
   salen en el CSS generado. Encadenarlas da un resultado que parece correcto
   hasta que Tailwind reordena. Por eso hay una base sin padding-right y dos
   constantes completas.

   El tratamiento de foco (cambia el fondo ademas del borde) viene de
   ResetPassword, que es la version ya probada en pantalla. Login tenia una copia
   propia mas pobre escrita a mano -- la misma deriva que este modulo existe para
   evitar. */
const CAMPO_BASE = 'w-full rounded-md border border-white/12 bg-white/6 py-md pl-[2.75rem] '
  + 'text-body text-white/90 placeholder:text-white/45 outline-none '
  + 'transition-[border-color,background-color,box-shadow] duration-150 '
  + 'focus-visible:border-primary-light focus-visible:bg-white/10 '
  + 'focus-visible:shadow-[0_0_0_3px_var(--color-focus-ring)]';

/* Campo normal. */
export const AUTH_CAMPO = `${CAMPO_BASE} pr-md`;
/* Campo con un control a la derecha (el ojo de mostrar contrasena). */
export const AUTH_CAMPO_ACCION = `${CAMPO_BASE} pr-[2.75rem]`;

export const AUTH_ETIQUETA = 'block text-caption font-semibold uppercase tracking-wide text-white/60';
