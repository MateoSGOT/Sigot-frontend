/* ═══════════════════════════════════════════════════════════════════════════
   FLUJO POR PASOS — clases compartidas por /registro y /agendar.

   Reemplaza a flujo-progresivo.css (473 líneas). Mismo motivo que clasesAuth.js
   y clasesOrdenDetalle.js: las dos vistas tienen que verse idénticas, y un
   literal compartido lo garantiza mejor que dos copias.

   DOS DECISIONES QUE OBLIGÓ A TOMAR EL ENCARGO

   1. SUPERFICIE CLARA, no surface-dark. El encargo pedía "surface-dark u
      opacidades controladas según el contexto del panel". El contexto es claro:
      a /registro se llega desde el enlace del login (claro) y /agendar vive
      dentro del portal (claro). Oscurecer estas dos reintroduciría exactamente
      la incoherencia que se acaba de corregir al revertir el login. Se toma la
      segunda mitad de la instrucción: manda el contexto.

   2. LA MARCA PASA DE ÁMBAR A COBALTO. El cuadrito "S" de la cabecera usaba
      --color-accent. En este sistema el ámbar significa "en proceso / requiere
      atención", y además el login muestra su marca en cobalto. Dos marcas de
      distinto color en pantallas consecutivas es justo lo que se está
      arreglando.

   TAMBIÉN SE CAE un resto de la identidad vieja: el botón principal tenía
   hover:box-shadow var(--shadow-green), un halo verde anterior al cobalto. Es
   el mismo que ya se quitó del botón del login.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Lienzo y tarjeta ──
   El contenedor declara `flujo` como contenedor con NOMBRE. Las consultas de
   abajo apuntan a él explícitamente (@max-[480px]/flujo) y no al más cercano,
   que dentro del portal podría ser otro. Mismo criterio que Table.css y que el
   calendario de Agenda: lo que decide el layout es el ancho del PANEL, no el
   del monitor. */
/* OJO con el umbral de ESTE elemento: usa max-[480px] (pantalla) y no
   @max-[480px]/flujo (contenedor), aunque sea el que DECLARA el contenedor.

   Una consulta de contenedor se evalua contra un ANCESTRO que sea contenedor:
   un elemento nunca es el suyo propio. Escritas como @max-[480px]/flujo, estas
   dos reglas generaban CSS valido que no habria coincidido nunca, y el lienzo
   habria conservado su padding en movil.

   Ademas aqui la pantalla es la medida correcta: este elemento ocupa el
   viewport, no una celda. Los descendientes (tarjeta, OTP, filas de dos
   campos) si consultan al contenedor, que es lo que pedia el encargo. */
export const FLUJO_PAGINA = '@container/flujo flex min-h-dvh items-center justify-center bg-bg p-lg '
  + 'max-[480px]:items-stretch max-[480px]:p-0';

export const FLUJO_TARJETA = 'w-full max-w-[460px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg '
  + '@max-[480px]/flujo:min-h-dvh @max-[480px]/flujo:max-w-none @max-[480px]/flujo:rounded-none '
  + '@max-[480px]/flujo:border-0 @max-[480px]/flujo:shadow-none';
export const FLUJO_TARJETA_ANCHA = 'max-w-[560px]';

/* ── Cabecera ── */
export const FLUJO_CABECERA = 'flex items-center justify-between border-b border-border-light px-xl py-lg';
/* min-h 48px: es un control, y en móvil se pulsa con el pulgar. */
export const FLUJO_VOLVER = 'inline-flex min-h-[48px] cursor-pointer items-center gap-xs border-0 bg-transparent '
  + 'text-small font-semibold text-text-muted no-underline transition-colors duration-150 hover:text-text '
  + 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
export const FLUJO_MARCA = 'inline-flex items-center gap-sm';
export const FLUJO_MARCA_LOGO = 'grid size-7 place-items-center rounded-[8px] bg-primary text-[0.95rem] font-black text-primary-on';
export const FLUJO_MARCA_NOMBRE = 'font-extrabold tracking-tight text-text';

/* ── Barra de progreso ── */
export const FLUJO_PROGRESO = 'px-xl pt-xl';
export const FLUJO_RIEL = 'relative mb-md h-1 overflow-hidden rounded-full bg-neutral-soft';
/* El ancho lo fija el componente; la transición da el efecto "líquido". */
export const FLUJO_RELLENO = 'h-full rounded-full bg-linear-to-r from-primary-strong to-primary-light '
  + 'transition-[width] duration-[460ms] ease-out';
export const FLUJO_PASOS = 'm-0 flex list-none justify-between p-0';
export const FLUJO_PASO = 'flex flex-1 flex-col items-center gap-[6px]';
export const FLUJO_BOLITA = 'grid size-[26px] place-items-center rounded-full border-2 text-caption font-bold '
  + 'transition-[background-color,border-color,color,transform] duration-200';
export const FLUJO_BOLITA_INERTE = 'border-border bg-surface text-text-light';
export const FLUJO_BOLITA_ACTIVA = 'scale-[1.12] border-primary-strong bg-primary-strong text-primary-on';
export const FLUJO_BOLITA_HECHA = 'border-primary-strong bg-primary-soft text-primary-soft-on';
export const FLUJO_PASO_NOMBRE = 'text-center text-[0.6875rem] font-semibold transition-colors duration-200';
export const FLUJO_PASO_NOMBRE_INERTE = 'text-text-light';
export const FLUJO_PASO_NOMBRE_ACTIVO = 'text-text';
export const FLUJO_PASO_NOMBRE_HECHO = 'text-primary-soft-on';

/* ── Cuerpo y tipografía ── */
export const FLUJO_CUERPO = 'p-xl';
export const FLUJO_TITULO = 'mt-0 mb-[6px] text-h1 font-bold text-text';
export const FLUJO_SUB = 'mt-0 mb-xl text-body leading-[1.55] text-text-muted '
  + '[&_strong]:font-semibold [&_strong]:text-text';

/* ── Campo con label flotante ──
   El label arranca centrado como marcador y sube al enfocar o cuando ya hay
   texto. Eso lo detecta :placeholder-shown, de ahí el placeholder=" " del JSX.
   En utilidades se expresa con `peer`: el input es el par y el label reacciona. */
export const CAMPO = 'mb-lg';
export const CAMPO_CAJA = 'relative';
export const CAMPO_ICONO = 'pointer-events-none absolute left-md top-1/2 -translate-y-1/2 text-text-light '
  + 'transition-colors duration-150 peer-focus:text-primary-strong';
/* 52px de alto: por encima del mínimo táctil de 48. */
export const CAMPO_INPUT = 'peer h-[52px] w-full rounded-md border-[1.5px] border-border bg-input-bg '
  + 'pt-[18px] pr-[40px] pb-[6px] pl-[38px] text-[0.9375rem] text-text outline-none '
  + 'transition-[border-color,box-shadow,background-color] duration-150 '
  + 'focus:border-focus focus:bg-surface focus:shadow-[0_0_0_3px_var(--color-focus-ring)]';
export const CAMPO_INPUT_SELECT = 'cursor-pointer appearance-none pt-[6px]';
export const CAMPO_LABEL = 'pointer-events-none absolute left-[38px] top-1/2 origin-left -translate-y-1/2 '
  + 'text-[0.9375rem] text-text-light transition-[transform,color] duration-200 '
  + 'peer-focus:-translate-y-[21px] peer-focus:scale-[0.78] peer-focus:text-primary-strong '
  + 'peer-[&:not(:placeholder-shown)]:-translate-y-[21px] peer-[&:not(:placeholder-shown)]:scale-[0.78] '
  + 'peer-[&:not(:placeholder-shown)]:text-text-muted';
export const CAMPO_CHECK = 'absolute top-1/2 -mt-[9px] text-success-strong';
export const CAMPO_ERROR_INPUT = 'border-danger-strong focus:shadow-[0_0_0_3px_var(--color-danger-soft)]';
export const CAMPO_ERROR_ICONO = 'text-danger-strong';
export const CAMPO_MSG_ERROR = 'mt-[5px] block text-caption text-danger-soft-on';
/* El ojo es un control: 48px de área táctil aunque el icono mida 18. */
export const CAMPO_OJO = 'absolute right-xs top-1/2 grid size-[48px] -translate-y-1/2 cursor-pointer '
  + 'place-items-center rounded-[6px] border-0 bg-transparent text-text-light '
  + 'transition-[color,background-color] duration-150 hover:bg-neutral-soft hover:text-text '
  + 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/* Dos campos en una fila; en estrecho se apilan. */
export const FLUJO_FILA_2 = 'grid grid-cols-2 gap-md @max-[480px]/flujo:grid-cols-1 @max-[480px]/flujo:gap-0';

/* ── OTP ── */
export const OTP = 'mb-lg grid grid-cols-6 gap-sm @max-[480px]/flujo:gap-[6px]';
export const OTP_CAJA = 'h-[54px] w-full rounded-md border-[1.5px] border-border bg-input-bg text-center '
  + 'text-[1.375rem] font-bold tabular-nums text-text outline-none '
  + 'transition-[border-color,box-shadow,transform] duration-150 '
  + 'focus:-translate-y-[2px] focus:border-focus focus:shadow-[0_0_0_3px_var(--color-focus-ring)] '
  + '@max-[480px]/flujo:h-[48px] @max-[480px]/flujo:text-[1.125rem]';
export const OTP_CAJA_LLENO = 'border-primary-strong bg-surface';
export const OTP_CAJA_ERROR = 'border-danger-strong';

/* ── Botones ──
   48px es el mínimo táctil del sistema, y ahora el secundario lo cumple
   TAMBIÉN: antes medían 48 y 40. "Atrás" se pulsa con el pulgar igual que
   "Siguiente", así que no hay razón para que sea más pequeño. */
export const FLUJO_BOTON = 'mt-sm grid h-[48px] w-full cursor-pointer place-items-center rounded-md border-0 '
  + 'bg-primary-strong text-[0.9375rem] font-bold text-primary-on '
  + 'transition-[background-color,transform,opacity] duration-150 '
  + 'hover:not-disabled:-translate-y-px hover:not-disabled:bg-primary-strong-hover '
  + 'active:not-disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 '
  + 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
export const FLUJO_BOTON_SECUNDARIO = 'mt-0 bg-transparent font-semibold text-text-muted '
  + 'hover:not-disabled:translate-y-0 hover:not-disabled:bg-neutral-soft hover:not-disabled:text-text';
export const FLUJO_BOTON_CARGANDO = 'cursor-progress opacity-80';
export const FLUJO_SPINNER = 'size-[19px] animate-spin rounded-full border-[2.5px] border-primary-on/35 border-t-primary-on';

/* ── Mensajes ── */
export const FLUJO_ERROR = 'mt-0 mb-md rounded-sm border border-danger-strong bg-danger-soft px-md py-sm '
  + 'text-small text-danger-soft-on';
export const FLUJO_AVISO = 'mt-0 mb-lg flex items-start gap-[7px] rounded-sm bg-surface-solid px-md py-sm '
  + 'text-caption leading-normal text-text-muted [&_svg]:mt-px [&_svg]:shrink-0 [&_svg]:text-text-light';
export const FLUJO_PIE = 'mt-lg mb-0 text-center text-small text-text-muted '
  + '[&_a]:font-bold [&_a]:text-primary-soft-on [&_a]:no-underline hover:[&_a]:underline '
  + '[&_button]:cursor-pointer [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[length:inherit] '
  + '[&_button]:font-bold [&_button]:text-primary-soft-on hover:[&_button]:underline';

/* ── Carga final ── */
export const FLUJO_CARGA = 'flex flex-col items-center gap-lg px-lg py-2xl text-center';
export const FLUJO_CARGA_SPINNER = 'size-[44px] animate-spin rounded-full border-[3.5px] border-neutral-soft border-t-primary-strong';
export const FLUJO_CARGA_TITULO = 'm-0 text-h3 font-bold text-text';
export const FLUJO_CARGA_ETAPAS = 'm-0 w-full max-w-[280px] list-none p-0';
export const FLUJO_CARGA_ETAPA = 'flex items-center gap-sm py-[7px] text-small text-text-light '
  + 'transition-colors duration-200 [&_svg]:shrink-0';
export const FLUJO_CARGA_ETAPA_ACTIVA = 'font-semibold text-text';
export const FLUJO_CARGA_ETAPA_HECHA = 'text-success-soft-on';

/* ── Reenvío del código ── */
export const FLUJO_REENVIO = 'mt-lg text-center';
export const FLUJO_REENVIO_ESPERA = 'text-small text-text-light';
export const FLUJO_REENVIO_BTN = 'min-h-[48px] cursor-pointer rounded-[6px] border-0 bg-transparent px-sm '
  + 'text-small font-bold text-primary-soft-on transition-colors duration-150 '
  + 'hover:not-disabled:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50 '
  + 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
