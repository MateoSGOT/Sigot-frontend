/* ═══════════════════════════════════════════════════════════════════════════
   AVISO EN LINEA DE UN CAMPO — clases compartidas, en utilidades de Tailwind.

   POR QUE EXISTE ESTE ARCHIVO
   `.novedad-warning` estaba definida UNICAMENTE en AgendaPage.css, pero la
   usaban Agenda (dos veces) y Ordenes (una). Ordenes no importa esa hoja, asi
   que su aviso solo salia con estilo si el usuario habia pasado antes por
   Agenda y el chunk seguia cargado.

   No era una hipotesis: entrando directo a /ordenes, un <p class="novedad-warning">
   computaba color rgb(10,10,11), display block y 16px -- texto negro corriente
   donde tenia que haber un aviso ambar de 0.78rem en linea. Es el mismo defecto
   que ya aparecio con .empty-list y con .cell-user__avatar--initial: una clase
   que vive en el CSS de una pagina y la usa otra.

   En JS la duplicacion se resuelve con un import, y estas constantes no
   participan de la cascada: no hay orden de carga que las pise.

   CONTRASTE: el CSS anterior usaba var(--color-accent), el ambar puro, que mide
   2.15:1 sobre blanco -- menos de la mitad del minimo AA. Un aviso que explica
   por que no se puede agendar o asignar tiene que leerse, asi que el texto pasa
   a --color-warning-soft-on (#B45309, 5.02:1). El icono de advertencia conserva
   el ambar: ahi el color es una senal, no texto.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Aviso que aparece bajo un campo del formulario. El tamano (0.78rem) no cae en
   ningun token -- queda como valor literal para no mover lo que ya estaba. */
export const AVISO_CAMPO =
  'mt-[0.375rem] flex items-center gap-xs text-[0.78rem] text-warning-soft-on';
