/* ═══════════════════════════════════════════════════════════════════════════
   NOTIFICACIONES — clases del listado y de la matriz de suscripción.

   Vive en shared/ y no dentro de la feature porque lo consumen DOS pantallas:
   la vista centralizada (/notificaciones) y la tarjeta de suscripción de
   RolesPage. Las dos pintan los mismos cuatro tipos y tienen que verse igual;
   si cada una escribiera sus cadenas, el día que cambie el color de STOCK_BAJO
   cambiaría en una sola.

   POR QUÉ color-mix() Y NO UN TOKEN POR TIPO
   Cada tipo necesita tres valores (fondo tenue del icono, borde, tinta) y son
   cuatro tipos: doce tokens nuevos para algo que se deriva mecánicamente de un
   color base. color-mix() los calcula a partir del token que ya existe, así que
   el sistema de color sigue teniendo UNA fuente por tipo.

   Se mezcla en oklab y no en sRGB: al diluir un color saturado contra
   transparente, sRGB lo apaga hacia el gris de forma visible. En oklab la
   mezcla mantiene el tono, que es justo lo que hace que un 14 % de ámbar siga
   leyéndose como ámbar y no como beige.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Los cuatro tipos, con su token base. El orden es el del enum del backend
   (TipoNotificacion), para que la matriz de RolesPage y el enum no se
   desordenen uno respecto al otro. */
export const TIPOS_NOTIFICACION = [
  { tipo: 'CITAS',       label: 'Citas',        token: 'info',    descripcion: 'Nuevas citas agendadas por clientes o desde el panel.' },
  { tipo: 'STOCK_BAJO',  label: 'Stock bajo',   token: 'warning', descripcion: 'Un repuesto cayó por debajo de su stock mínimo.' },
  { tipo: 'LOGISTICA',   label: 'Logística',    token: 'teal',    descripcion: 'Movimientos de compras, proveedores y entregas.' },
  { tipo: 'FACTURACION', label: 'Facturación',  token: 'success', descripcion: 'Órdenes marcadas como facturadas o con cobro pendiente.' },
];

export const META_TIPO = Object.fromEntries(TIPOS_NOTIFICACION.map(t => [t.tipo, t]));

/* Las tres mezclas de un tipo. Se devuelven como estilo en línea y no como
   clases porque el token es DINÁMICO (sale del dato): una utilidad arbitraria
   construida con una variable de JS nunca aparece completa en el código fuente,
   y Tailwind escanea texto -- no se generaría. Ya pasó en este repositorio con
   una trama de fondo partida en dos literales.

   Con estilo en línea el navegador resuelve color-mix() en tiempo de ejecución
   y el valor sigue viniendo del token, así que la auditoría de paleta no ve
   ningún color suelto. */
export const estiloTipo = (tipo) => {
  const token = META_TIPO[tipo]?.token || 'neutral';
  const base = `var(--color-${token})`;
  return {
    background: `color-mix(in oklab, ${base} 14%, transparent)`,
    borderColor: `color-mix(in oklab, ${base} 38%, transparent)`,
    color: `color-mix(in oklab, ${base} 86%, var(--color-text))`,
  };
};

/* El icono: cuadrado de 44px, que es área táctil suficiente cuando toda la
   fila es pulsable y evita que la densidad alta lo deje en un punto. */
export const NOTIF_ICONO = 'flex size-[44px] shrink-0 items-center justify-center rounded-xl border';

/* ── Listado ──
   ALTURA ACOTADA Y SCROLL PROPIO. La lista no crece hasta empujar la página:
   se queda dentro de su módulo del bento con su propio desplazamiento, así la
   cabecera y el botón de "marcar todas" siguen visibles con 200 alertas. El
   alto es relativo al viewport menos el espacio de la cabecera, no un píxel
   fijo, para que en una pantalla corta no quede una ventanita de tres filas.

   overscroll-contain evita que al llegar al final del listado el gesto siga
   desplazando la página por detrás, que en móvil se siente como un salto. */
export const NOTIF_LISTA = 'flex max-h-[calc(100dvh-20rem)] min-h-[16rem] flex-col overflow-y-auto '
  + 'overscroll-contain divide-y divide-border';

/* Cada fila: min-h-[48px] es el mínimo táctil, y el padding la lleva en la
   práctica a ~72px con dos líneas de texto. La fila entera es el objetivo
   pulsable (no solo un botón al final), que es lo que permite marcarla como
   leída con el pulgar sin apuntar. */
export const NOTIF_FILA = 'flex min-h-[48px] w-full items-start gap-md px-lg py-md text-left '
  + 'transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover '
  + 'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary';

/* La no leída se marca con una franja de acento a la izquierda, no con un fondo
   distinto: con alta densidad, dos fondos alternándose hacen que la lista
   parezca una tabla rayada y se pierde cuál es el estado real. */
export const NOTIF_FILA_NO_LEIDA = 'border-l-[3px] border-l-primary bg-primary-wash';
export const NOTIF_FILA_LEIDA = 'border-l-[3px] border-l-transparent';

export const NOTIF_TITULO = 'text-body font-bold text-text';
export const NOTIF_TITULO_LEIDO = 'text-body font-semibold text-text-muted';
export const NOTIF_MENSAJE = 'mt-xs text-small leading-snug text-text-muted';
export const NOTIF_FECHA = 'mt-xs text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-text-muted';

/* La píldora del tipo. Hereda los colores por estilo en línea (estiloTipo). */
export const NOTIF_PILDORA = 'inline-flex items-center rounded-full border px-sm py-[0.1rem] '
  + 'text-[0.68rem] font-bold uppercase tracking-[0.04em]';

export const NOTIF_VACIO = 'flex flex-col items-center justify-center gap-sm px-lg py-2xl text-center';

/* ── Filtros ──
   Área táctil de 44px por pastilla y envoltura, para que en móvil no haya que
   apuntar a un texto de 13px. */
export const NOTIF_FILTROS = 'flex flex-wrap items-center gap-sm';
export const NOTIF_FILTRO = 'inline-flex min-h-[44px] items-center gap-xs rounded-lg border border-border '
  + 'bg-surface px-lg text-body font-semibold text-text-muted transition-colors hover:bg-surface-hover';
export const NOTIF_FILTRO_ACTIVO = 'border-primary bg-primary-soft text-primary-soft-on';

/* ── Matriz de suscripción (RolesPage) ──
   auto-fit con un mínimo de 15rem: con el modal ancho entran dos por fila y al
   estrecharse caen a una, sin media query. El contenedor es un módulo del bento
   y su ancho no lo decide el viewport, así que un breakpoint de pantalla
   acertaría solo por casualidad. */
export const SUSCRIP_REJILLA = 'grid gap-md [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]';

/* Toda la tarjeta es la etiqueta del checkbox: el objetivo táctil es la tarjeta
   completa, no la casilla de 18px. */
export const SUSCRIP_TARJETA = 'flex min-h-[48px] cursor-pointer items-start gap-md rounded-xl border '
  + 'border-border bg-surface px-lg py-md transition-colors hover:bg-surface-hover select-none';
export const SUSCRIP_TARJETA_ACTIVA = 'border-primary bg-primary-wash';
export const SUSCRIP_CASILLA = 'mt-[0.15rem] size-[18px] shrink-0 cursor-pointer accent-primary';
export const SUSCRIP_LABEL = 'text-body font-bold text-text';
export const SUSCRIP_DESC = 'mt-xs text-small leading-snug text-text-muted';
