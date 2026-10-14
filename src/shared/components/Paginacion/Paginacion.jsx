import React from 'react';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';

/* Control de paginación — EXTRAÍDO de Table.jsx, no reescrito.
 *
 * Vivía dentro de Table y lo usaban todos los módulos (servicios, repuestos,
 * compras, órdenes...). La vista de notificaciones no es una tabla -- es una
 * lista densa dentro de un módulo del bento -- así que para paginarla había dos
 * caminos: convertirla en tabla, perdiendo el diseño, o copiar el bloque.
 *
 * Copiarlo es lo que hace que dos controles que deberían ser el mismo empiecen a
 * divergir: basta que alguien ajuste el área táctil en uno. Se extrae en su
 * lugar, Table pasa a consumirlo, y queda UNA implementación para las dos.
 *
 * El marcado y las clases son los mismos (.table-pagination*), así que ningún
 * módulo cambia de aspecto: el CSS que ya existe sigue aplicando igual.
 *
 * `max-lg:min-h-[44px]` en los botones es el área táctil mínima en móvil, donde
 * un botón de 28px obliga a apuntar. En escritorio se pulsa con ratón y manda el
 * tamaño compacto, que es lo que permite que el control no pese en la página.
 */
export default function Paginacion({ page, totalPages, onPageChange }) {
  // Una sola página (o ninguna) no necesita control: ocupar sitio para decir
  // "1 de 1" es ruido.
  if (!(totalPages > 1)) return null;

  const irA = (p) => onPageChange?.(Math.max(1, Math.min(p, totalPages)));

  return (
    <div className="table-pagination">
      <button
        className="table-pagination__btn max-lg:min-h-[44px] max-lg:min-w-[44px]"
        onClick={() => irA(page - 1)}
        disabled={page === 1}
        aria-label="Página anterior"
      >
        <MdChevronLeft size={16} />
      </button>
      <span className="table-pagination__current">{page}</span>
      <span className="table-pagination__sep">de</span>
      <span className="table-pagination__total">{totalPages}</span>
      <button
        className="table-pagination__btn max-lg:min-h-[44px] max-lg:min-w-[44px]"
        onClick={() => irA(page + 1)}
        disabled={page === totalPages}
        aria-label="Página siguiente"
      >
        <MdChevronRight size={16} />
      </button>
    </div>
  );
}
