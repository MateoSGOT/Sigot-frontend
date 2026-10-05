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

/* Filas para la tabla de Repuestos. Cubren A PROPÓSITO los tres estados de
   stock, que son el motivo de existir de esta pantalla:
   · Stock 0            → insignia AGOTADO y banner crítico
   · Stock <= StockMinimo → insignia STOCK BAJO
   · Stock holgado      → celda normal, sin adorno
   Además, un nombre largo (para ver el corte en modo tarjeta), un precio de
   venta nulo (repuesto sin compras aún) y un margen fuera del 50% por defecto. */
export const MAQUETA_FILAS_REPUESTOS = [
  { Id_Repuesto: 7001, Nombre: 'Pastillas de freno delanteras cerámicas (juego x4)',
    Categoria: 'Frenos', Stock: 0, StockMinimo: 4, Precio: 86000,
    MargenPorcentaje: 45, PrecioVenta: 148509, Estado: 1 },
  { Id_Repuesto: 7002, Nombre: 'Filtro de aceite', Categoria: 'Motor',
    Stock: 3, StockMinimo: 6, Precio: 18500, MargenPorcentaje: 60,
    PrecioVenta: 35231, Estado: 1 },
  { Id_Repuesto: 7003, Nombre: 'Bujía iridio NGK', Categoria: 'Encendido',
    Stock: 6, StockMinimo: 6, Precio: 24900, MargenPorcentaje: 50,
    PrecioVenta: 44453, Estado: 1 },
  { Id_Repuesto: 7004, Nombre: 'Correa de repartición', Categoria: 'Motor',
    Stock: 27, StockMinimo: 5, Precio: 132000, MargenPorcentaje: 38,
    PrecioVenta: 216580, Estado: 1 },
  { Id_Repuesto: 7005, Nombre: 'Amortiguador trasero', Categoria: 'Suspensión',
    Stock: 12, StockMinimo: 4, Precio: null, MargenPorcentaje: 50,
    PrecioVenta: null, Estado: 0 },
];

/* Filas para la tabla de Compras. OJO con la forma: esta tabla es por LINEA DE
   PRODUCTO, no por compra -- una compra con tres repuestos son tres filas que
   comparten proveedor y N.° de factura, y el Total de cada fila se calcula como
   Cantidad x PrecioUnitario (ver la columna 'total'). Las dos primeras
   comparten factura a proposito, que es el caso que agrupa el detalle.
   Incluye una compra anulada, para ver la insignia y que desaparezca su boton
   de anular. */
export const MAQUETA_FILAS_COMPRAS = [
  { Id_Compra: 5101, Id_Proveedor: 31, Proveedor: 'Importadora Andina S.A.S.',
    Id_Repuesto: 7001, Repuesto: 'Pastillas de freno delanteras cerámicas (juego x4)',
    Cantidad: 12, PrecioUnitario: 86000, DescuentoPorcentaje: 10,
    Fecha: '2026-09-30', NumeroFactura: 'FV-00841', Anulada: false },
  { Id_Compra: 5102, Id_Proveedor: 31, Proveedor: 'Importadora Andina S.A.S.',
    Id_Repuesto: 7002, Repuesto: 'Filtro de aceite',
    Cantidad: 6, PrecioUnitario: 18500, DescuentoPorcentaje: 0,
    Fecha: '2026-09-30', NumeroFactura: 'FV-00841', Anulada: false },
  { Id_Compra: 5103, Id_Proveedor: 44, Proveedor: 'Lubricantes Monserrate',
    Id_Repuesto: 7003, Repuesto: 'Bujía iridio NGK',
    Cantidad: 4, PrecioUnitario: 46000, DescuentoPorcentaje: 0,
    Fecha: '2026-09-14', NumeroFactura: 'FV-00798', Anulada: true },
];

/* Líneas del detalle de una compra: cubren descuento aplicado, ganancia
   negativa (se pinta en rojo) y una cantidad de dos dígitos. */
export const MAQUETA_DETALLE_COMPRA = [
  { Repuesto: 'Pastillas de freno delanteras cerámicas (juego x4)', Cantidad: 12,
    PrecioUnitario: 86000, DescuentoPorcentaje: 10, PrecioVenta: 148509 },
  { Repuesto: 'Filtro de aceite', Cantidad: 6, PrecioUnitario: 18500,
    DescuentoPorcentaje: 0, PrecioVenta: 35231 },
  { Repuesto: 'Bujía iridio NGK', Cantidad: 4, PrecioUnitario: 46000,
    DescuentoPorcentaje: 0, PrecioVenta: 44453 },
];

/* Citas para el calendario de Agenda. Las fechas se generan relativas al mes
   EN CURSO -- un literal fijo quedaria fuera del mes que el calendario abre por
   defecto y la rejilla se veria vacia.

   Cubren los seis estados (cada uno pinta su chip de un color distinto) y, a
   proposito, un dia con CUATRO citas: el calendario solo muestra tres chips por
   celda y añade "+N mas", que es una rama que hay que poder ver. */
/* La anotacion /*#__PURE__*\/ no es decorativa. Esto es una IIFE, y para el
   empaquetador una llamada a funcion puede tener efectos secundarios, asi que
   la conserva aunque nadie use el resultado: el chunk de maqueta volvio a
   aparecer en dist/ con nombres y placas inventadas en cuanto lo escribi asi,
   y lo detecto scripts/auditar-maqueta.mjs. La anotacion declara que la llamada
   solo calcula un valor, y entonces si se elimina al no referenciarse.
   Las fechas tienen que ser relativas al mes EN CURSO -- un literal fijo caeria
   fuera del mes que el calendario abre por defecto -- de ahi la funcion. */
export const MAQUETA_CITAS = /* #__PURE__ */ (() => {
  const hoy = new Date();
  const dia = (n) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const base = { Estado: 1, Id_Empleado: 12, empleado: 'Jair Calle', Servicio: 'Mantenimiento' };
  return [
    { ...base, Id_Agenda: 8101, FechaAgendamiento: dia(4),  Hora: '08:00', cliente: 'Daniela Restrepo', vehiculo: 'MTX-412', EstadoCita: 'Confirmada',    DuracionEstimadaMin: 60 },
    { ...base, Id_Agenda: 8102, FechaAgendamiento: dia(4),  Hora: '09:30', cliente: 'Andrés Betancur',  vehiculo: 'KPR12E',  EstadoCita: 'Pendiente',     DuracionEstimadaMin: 45 },
    { ...base, Id_Agenda: 8103, FechaAgendamiento: dia(4),  Hora: '11:00', cliente: 'Marcela Ossa',     vehiculo: 'FTR-889', EstadoCita: 'Atendida',      DuracionEstimadaMin: 60 },
    { ...base, Id_Agenda: 8104, FechaAgendamiento: dia(4),  Hora: '14:00', cliente: 'Hernán Lopera',    vehiculo: 'BQW-203', EstadoCita: 'NoAsistio',     DuracionEstimadaMin: 45 },
    { ...base, Id_Agenda: 8105, FechaAgendamiento: dia(11), Hora: '10:00', cliente: 'Luisa Cardona',    vehiculo: 'TGH-556', EstadoCita: 'Cancelada',     DuracionEstimadaMin: 60 },
    { ...base, Id_Agenda: 8106, FechaAgendamiento: dia(18), Hora: '07:30', cliente: 'Camilo Zapata',    vehiculo: 'PLM-074', EstadoCita: 'Confirmada',    DuracionEstimadaMin: 90 },
    { ...base, Id_Agenda: 8107, FechaAgendamiento: dia(23), Hora: '15:30', cliente: 'Verónica Agudelo', vehiculo: 'RST-311', EstadoCita: 'Pendiente',     DuracionEstimadaMin: 45 },
  ];
})();

/* Flota de vehiculos. Incluye a proposito una placa de moto de 6 caracteres, un
   kilometraje de seis digitos, un color con nombre largo y un vehiculo inactivo
   -- los cuatro casos que descuadran la tabla o su version en tarjetas. */
export const MAQUETA_VEHICULOS = [
  { Id_Vehiculo: 3201, Placa: 'MTX-412', Anio: 2019, Kilometraje: 184320, Color: 'Gris grafito',   Cliente: 'Daniela Restrepo', Estado: 1 },
  { Id_Vehiculo: 3202, Placa: 'KPR12E',  Anio: 2022, Kilometraje: 23870,  Color: 'Rojo',           Cliente: 'Andrés Betancur',  Estado: 1 },
  { Id_Vehiculo: 3203, Placa: 'FTR-889', Anio: 2016, Kilometraje: 241905, Color: 'Blanco perlado', Cliente: 'Marcela Ossa',     Estado: 1 },
  { Id_Vehiculo: 3204, Placa: 'BQW-203', Anio: 2024, Kilometraje: 4120,   Color: 'Azul',           Cliente: 'Hernán Lopera',    Estado: 0 },
];

/* Clientes. Con un correo largo (caso que desborda la celda), un telefono vacio
   y una direccion que ocupa las dos columnas del detalle. */
export const MAQUETA_CLIENTES = [
  { Id_Cliente: 4101, Nombre: 'Daniela Restrepo', Documento: '1037654321', Correo: 'daniela.restrepo.osorio@correoempresarial.com.co', Telefono: '3105558899', Direccion: 'Cra 50 #38-21, Barrio Machado, Copacabana', Estado: 1 },
  { Id_Cliente: 4102, Nombre: 'Andrés Betancur',  Documento: '71998455',   Correo: 'abetancur@gmail.com',  Telefono: '',           Direccion: 'Calle 52 #47-10', Estado: 1 },
  { Id_Cliente: 4103, Nombre: 'Marcela Ossa',     Documento: '43887120',   Correo: 'marcela.ossa@outlook.com', Telefono: '3012244557', Direccion: 'Vereda El Convento, km 3', Estado: 0 },
];

/* Cuentas: mezcla de empleado y cliente, con y sin rol asignado. La primera
   simula ser la del propio usuario, que es la que lleva la insignia "Tú". */
export const MAQUETA_CUENTAS = [
  { TipoOrigen: 'empleado', IdOrigen: 12, Nombre: 'Jair Calle',       Correo: 'jair.calle@sigot.com',  Documento: '98765432',   Id_Rol: 1,    Rol: 'Administrador' },
  { TipoOrigen: 'empleado', IdOrigen: 18, Nombre: 'Sebastián Muñoz',  Correo: 'smunoz@sigot.com',      Documento: '1017334455', Id_Rol: 2,    Rol: 'Mecánico' },
  { TipoOrigen: 'cliente',  IdOrigen: 4101, Nombre: 'Daniela Restrepo', Correo: 'daniela.restrepo.osorio@correoempresarial.com.co', Documento: '1037654321', Id_Rol: null, Rol: null },
];
