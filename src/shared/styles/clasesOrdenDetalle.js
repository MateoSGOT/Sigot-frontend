/* ═══════════════════════════════════════════════════════════════════════════
   DETALLE DE ORDEN — clases del modal, en utilidades de Tailwind.

   Reemplaza a shared/styles/orden-detalle.css, que era la última hoja CSS
   compartida entre el modal del PANEL (OrdenesPage) y el del PORTAL. Los dos
   muestran la misma orden, así que tienen que verse igual.

   POR QUÉ ES UN MÓDULO JS Y NO UN CSS COMPARTIDO
   El archivo CSS existía justamente para no tener dos copias: antes cada página
   tenía la suya y los 16 selectores habían divergido en TODOS sus valores, con
   el agravante de que ganaba el de la página que el usuario visitara primero
   (las dos se cargan por code-splitting). Al pasar a utilidades, si cada página
   escribiera sus propias cadenas volveríamos al mismo problema.

   En JS la duplicación se resuelve con un import y, a diferencia del CSS, estas
   constantes NO participan de la cascada: no hay orden de carga que las pise ni
   especificidad que negociar. Y scripts/auditar-colisiones.mjs solo inspecciona
   hojas CSS, así que un literal compartido acá tampoco puede colisionar.

   DINERO EN TINTA, no en color: un importe no es un "éxito". Es el dato
   principal de la fila y lo que necesita es peso y cifras tabulares para que
   las columnas se comparen en vertical. El esmeralda queda reservado al estado
   "Realizado".
   ═══════════════════════════════════════════════════════════════════════════ */

export const OD_TABS = 'flex gap-0 border-b-2 border-border';

export const OD_TAB = 'cursor-pointer border-0 border-b-2 border-transparent bg-transparent '
  + '-mb-[2px] px-xl py-md font-[inherit] text-body font-semibold text-text-muted '
  + 'transition-colors duration-150 hover:text-text '
  + 'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus';

export const OD_TAB_ACTIVA = 'border-b-primary text-primary-soft-on';

/* El tope de altura con scroll propio evita que una orden con quince líneas
   empuje los totales fuera del modal. */
export const OD_LISTA = 'mb-xl flex max-h-[220px] flex-col gap-sm overflow-y-auto';

export const OD_FILA = 'flex items-center gap-lg rounded-md bg-surface-raised px-lg py-md text-body';
export const OD_NOMBRE = 'flex-1 font-semibold text-text';
export const OD_CANTIDAD = 'text-small text-text-muted tabular-nums';
export const OD_PRECIO = 'shrink-0 font-bold text-text tabular-nums';
export const OD_VACIO = 'p-xl text-center text-body text-text-muted';

export const OD_SUBTOTAL = 'mb-md flex items-center justify-between rounded-md bg-surface-raised '
  + 'px-lg py-md text-body font-bold text-text';

/* La franja de acento a la izquierda marca el bloque del total sin teñir la
   cifra, que es lo que se quiere leer. */
export const OD_TOTAL_CAJA = 'mt-xl overflow-hidden rounded-lg border border-border '
  + 'border-l-[3px] border-l-primary shadow-sm';

export const OD_TOTAL_DESGLOSE = 'flex flex-col gap-xs bg-surface-raised px-xl py-md';
export const OD_TOTAL_FILA = 'flex justify-between text-body text-text-muted tabular-nums';

export const OD_TOTAL_FINAL = 'flex items-center justify-between border-t border-border bg-surface '
  + 'px-xl py-lg text-h3 font-extrabold text-text';

/* La cifra del total, un paso por encima del rótulo: es lo único que el cliente
   busca al abrir esta pestaña. */
export const OD_TOTAL_CIFRA = 'text-h2 tabular-nums';
