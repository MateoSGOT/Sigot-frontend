/* ═══════════════════════════════════════════════════════════════════════════
   DATOS DE MAQUETA — SOLO DESARROLLO LOCAL

   Sirven para que el bento y los bloques .metric muestren cifras mientras se
   revisa el maquetado sin sesión. Sin esto, con VITE_DEV_SKIP_AUTH activo las
   peticiones reciben 401 y todo queda en cero: se ve la estructura, pero no el
   peso tipográfico de las cifras, que es justo lo que hay que juzgar.

   LA MISMA DOBLE CONDICIÓN QUE EL BYPASS DE SESIÓN, por el mismo motivo:
   · import.meta.env.DEV lo deja en `false` literal al compilar, así que la rama
     se elimina del bundle de producción por dead-code elimination.
   · VITE_DEV_SKIP_AUTH tiene que valer 'true', y vive en .env.local, que está
     en .gitignore.

   Estos datos apuntan a páginas conectadas a la API de PRODUCCIÓN. Por eso no
   van inline en el componente: un objeto de prueba suelto dentro de una vista
   se despliega por accidente. Acá están aislados, con una sola puerta, y el
   marcador MAQUETA_MARCA permite verificar en dist/ que no quedó ni un rastro.

   SON ESTABLES, no aleatorios: las cifras tienen que ser las mismas en cada
   recarga para poder comparar dos capturas de la misma pantalla.
   ═══════════════════════════════════════════════════════════════════════════ */

export const MAQUETA_ACTIVA = import.meta.env.DEV
  && import.meta.env.VITE_DEV_SKIP_AUTH === 'true';

/* Cadena única y rastreable. Si aparece en dist/, los datos de maqueta se
   filtraron al bundle de producción y hay que revisar por qué el tree-shaking
   no eliminó la rama. */
export const MAQUETA_MARCA = 'SIGOT_MAQUETA_LOCAL_NO_PRODUCCION';

/* Resumen que alimenta las cuatro celdas .metric de OrdenesPage.
   Cifras elegidas para ser realistas en un taller chico y, sobre todo, de
   ANCHOS DISTINTOS entre sí: con 11/8/37 se ve si las cifras tabulares alinean
   y si una de tres dígitos desborda su celda, que es lo que hay que detectar. */
export const MAQUETA_RESUMEN_ORDENES = {
  pendientes: 11,
  enProceso: 8,
  realizadas: 137,
  total: 156,
};

/* Filas para la tabla. Incluyen a propósito los casos que rompen maquetados:
   un diagnóstico largo (se corta a dos líneas), una placa de moto de 6
   caracteres, un kilometraje de seis dígitos y una fecha de entrega vacía. */
export const MAQUETA_FILAS_ORDENES = [
  { Id_Orden: 9001, Vehiculo: 'MTX-412', Cliente: 'Daniela Restrepo',
    Diagnostico: 'Ruido metálico en suspensión delantera al pasar reductores; se revisan bujes y amortiguadores.',
    Kilometraje: 184320, FechaIngreso: '2026-09-28', FechaEntrega: null, Estado: 2 },
  { Id_Orden: 9002, Vehiculo: 'KPR12E', Cliente: 'Andrés Betancur',
    Diagnostico: 'Cambio de aceite y filtro.',
    Kilometraje: 27450, FechaIngreso: '2026-09-29', FechaEntrega: '2026-09-29', Estado: 3 },
  { Id_Orden: 9003, Vehiculo: 'HJS-887', Cliente: 'Comercializadora del Valle S.A.S.',
    Diagnostico: 'Revisión de frenos: pastillas delanteras al límite.',
    Kilometraje: 96180, FechaIngreso: '2026-10-01', FechaEntrega: null, Estado: 1 },
  { Id_Orden: 9004, Vehiculo: 'TQW-330', Cliente: 'Luz Marina Ospina',
    Diagnostico: 'Alineación y balanceo; desgaste irregular en llanta trasera izquierda.',
    Kilometraje: 51200, FechaIngreso: '2026-10-02', FechaEntrega: null, Estado: 2 },
  { Id_Orden: 9005, Vehiculo: 'BNM-015', Cliente: 'Jorge Iván Úsuga',
    Diagnostico: 'Sincronización de inyección.',
    Kilometraje: 142900, FechaIngreso: '2026-10-02', FechaEntrega: null, Estado: 1 },
];

/* Detalle de UNA orden, para poder revisar el modal (stepper, lineas, totales,
   mano de obra) sin sesion. Se expone aparte del listado porque el detalle lo
   trae un thunk distinto (fetchOrdenById) y, con CORS bloqueado en local, nunca
   llega.

   Estado 2 ("En proceso") a proposito: es el unico valor que deja ver las TRES
   fases del stepper a la vez -- un paso completado (check esmeralda), el actual
   (cobalto) y uno pendiente (gris). Con estado 1 o 3 siempre queda una fase sin
   representar y no se puede juzgar el codigo de color. */
export const MAQUETA_ORDEN_DETALLE = {
  Id_Orden: 9001,
  Vehiculo: 'MTX-412',
  Cliente: 'Daniela Restrepo',
  Diagnostico: 'Ruido metálico en suspensión delantera al pasar reductores; se revisan bujes y amortiguadores.',
  Observacion: 'El cliente autoriza cambio de bujes si el desgaste lo exige.',
  Kilometraje: 184320,
  FechaIngreso: '2026-09-28',
  FechaEntrega: null,
  Estado: 2,
  // El componente lee `mano_de_obra` (snake_case), no ManoDeObra: lo verifique
  // en el navegador porque el campo salia como "—" con la clave equivocada.
  mano_de_obra: 85000,
  DuracionTotalMin: 150,
  Empleado: 'Pedro Muñoz',
  servicios: [
    { Id_Servicio: 11, Nombre: 'Revisión de suspensión', precio_unitario: 60000, DuracionMinutos: 90, Id_Empleado: 3, Empleado: 'Pedro Muñoz' },
    { Id_Servicio: 12, Nombre: 'Alineación', precio_unitario: 45000, DuracionMinutos: 60, Id_Empleado: 3, Empleado: 'Pedro Muñoz' },
  ],
  repuestos: [
    { Id_Repuesto: 21, Nombre: 'Buje de suspensión delantero', cantidad: 2, precio_unitario: 38000 },
    { Id_Repuesto: 22, Nombre: 'Amortiguador delantero', cantidad: 2, precio_unitario: 145000 },
  ],
  mecanicos: [
    { id_empleado: 3, Nombre: 'Pedro Muñoz', esResponsable: true },
    { id_empleado: 7, Nombre: 'Luis Herrera', esResponsable: false },
  ],
};
