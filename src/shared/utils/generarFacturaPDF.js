import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { todayLocalYMD, formatDate } from './helpers.js';

/* ═══════════════════════════════════════════════════════════════════
   Facturas SIGOT — diseño alineado con la marca de la app, pero en
   escala de grises: la factura se imprime mucho (para el cliente), así
   que va toda a blanco y negro para no gastar tinta de color.
   ═══════════════════════════════════════════════════════════════════ */

// Escala de grises minimalista: texto negro sobre blanco y reglas finas.
// Sin bandas ni cajas rellenas → mínimo consumo de tinta al imprimir.
const INK   = [30, 30, 30];    // texto principal y títulos
const MUTED = [120, 120, 120]; // texto secundario
const LINE  = [200, 200, 200]; // reglas / bordes finos
const HAIR  = [232, 232, 232]; // líneas de tabla (muy tenues)
const WHITE = [255, 255, 255]; // relleno "vacío" de cabeceras de tabla

const PAGE_W = 210;
const M = 14;                     // margen lateral
const RIGHT = PAGE_W - M;         // 196

const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
    .format(Number(n) || 0);

const today = () => new Date().toLocaleDateString('es-CO');

/* ── Encabezado: wordmark + tipo + N°/fecha con una regla fina (sin banda). ── */
function addHeader(doc, tipo, numero, fecha) {
  // Wordmark
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.text('SIGOT', M, 18);

  // Tipo de documento: insignia con borde, en mayúsculas y bien visible -- antes
  // era un subtítulo gris chico (10pt) y "Diagnóstico" se confundía con "Orden de
  // trabajo" a simple vista. Ancho de caja según el texto (jsPDF getTextWidth).
  const tipoUpper = String(tipo).toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const tW = doc.getTextWidth(tipoUpper);
  const padX = 3, boxH = 7, boxY = 21;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.roundedRect(M, boxY, tW + padX * 2, boxH, 1.2, 1.2, 'S');
  doc.setTextColor(...INK);
  doc.text(tipoUpper, M + padX, boxY + boxH / 2, { baseline: 'middle' });

  // Derecha: número y fecha
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`N° ${numero}`, RIGHT, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Fecha: ${fecha}`, RIGHT, 22, { align: 'right' });

  // Regla fina bajo el encabezado
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(M, 30, RIGHT, 30);
}

/* ── Tarjeta de información (Proveedor / Cliente / Vehículo) ── */
function infoCard(doc, x, y, w, title, rows) {
  const padX = 7, padTop = 6, lineH = 5.4;
  const h = padTop + 5 + rows.length * lineH + 2.5;

  // Solo trazo fino, sin relleno ni barra de acento (mínima tinta).
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(title.toUpperCase(), x + padX, y + padTop + 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  let maxLabelW = 0;
  rows.forEach(([label]) => { maxLabelW = Math.max(maxLabelW, doc.getTextWidth(`${label}:`)); });

  let ry = y + padTop + 7.5;
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED); doc.setFontSize(9.5);
    doc.text(`${label}:`, x + padX, ry);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK);
    doc.text(String(value ?? '—'), x + padX + maxLabelW + 3, ry);
    ry += lineH;
  });
  return h;
}

/* ── Etiqueta de sección ── */
function sectionLabel(doc, text, x, y) {
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(text.toUpperCase(), x, y);
}

/* ── Líneas de resumen (a la derecha, antes del total) ── */
function summary(doc, y, rows) {
  doc.setFontSize(9.5);
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED);
    doc.text(label, 120, y);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK);
    doc.text(fmt(value), RIGHT, y, { align: 'right' });
    y += 6;
  });
  return y;
}

/* ── Total: regla fina + texto en negrita (sin caja rellena). ── */
function totalBox(doc, y, amount) {
  const x = 120;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.4);
  doc.line(x, y, RIGHT, y);
  y += 7;
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL', x, y);
  doc.setFontSize(13);
  doc.text(fmt(amount), RIGHT, y, { align: 'right' });
  return y + 3;
}

/* ── Pie de página ── */
function addFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2);
    doc.line(M, 284, RIGHT, 284);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('SIGOT · Copacabana, Antioquia', M, 289);
    doc.text('Gracias por su preferencia', PAGE_W / 2, 289, { align: 'center' });
    doc.text(`Página ${i} de ${pageCount}`, RIGHT, 289, { align: 'right' });
  }
}

/* Estilos de tabla: cuadrícula muy tenue, cabecera SIN relleno (solo negrita).
   Sin filas alternas → nada de fondos = mínima tinta. */
const tableBase = {
  theme: 'grid',
  styles: { lineColor: HAIR, lineWidth: 0.1, textColor: INK },
  headStyles: { fillColor: WHITE, textColor: INK, fontStyle: 'bold', fontSize: 9.5, cellPadding: 2.8, lineColor: LINE, lineWidth: 0.1 },
  bodyStyles: { fontSize: 9.5, textColor: INK, cellPadding: 2.6 },
  margin: { left: M, right: M },
};

/* ═══════════════ FACTURA DE ORDEN DE TRABAJO ═══════════════ */
// getTecnicoPrefijo: función opcional (idEmpleado) => "PM. " | null, EXACTAMENTE la
// misma que arma el prefijo de iniciales en pantalla (ver OrdenesPage.jsx::
// prefijoTecnico) -- ya trae aplicada la regla de solo mostrarlo con 2+ técnicos
// distintos entre los SERVICIOS de la orden. Este módulo no conoce el catálogo de
// empleados ni la lógica de conteo por su cuenta (a propósito, mismo patrón que
// generarFacturaCompra: el llamador resuelve nombres/IDs, el builder del PDF solo
// formatea). Se aplica SOLO a la tabla de Servicios -- "¿Quién lo hizo?" no existe
// para Repuestos (ver OrdenesPage.jsx), así que su tabla nunca lleva prefijo.
export function buildFacturaOrden(orden, { getTecnicoPrefijo } = {}) {
  const prefijoDe = (idEmpleado) => (typeof getTecnicoPrefijo === 'function' ? getTecnicoPrefijo(idEmpleado) : null) || '';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const id = orden.Id_Orden || orden.id || '?';

  addHeader(doc, 'Orden de trabajo', id, today());

  let y = 46;
  const colW = (RIGHT - M - 4) / 2;             // dos tarjetas con 4mm de separación
  const hCli = infoCard(doc, M, y, colW, 'Cliente', [
    ['Nombre', orden.Cliente || '—'],
    ['Documento', orden.ClienteDoc || '—'],
    ['Teléfono', orden.ClienteContacto || '—'],
  ]);
  const hVeh = infoCard(doc, M + colW + 4, y, colW, 'Vehículo', [
    ['Placa', orden.Vehiculo || '—'],
    ['Marca', orden.Marca || '—'],
    ['Modelo', orden.Modelo || '—'],
    ['Año', orden.Anio || '—'],
  ]);
  y += Math.max(hCli, hVeh) + 9;

  if (orden.servicios?.length) {
    sectionLabel(doc, 'Servicios', M, y); y += 2.5;
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [['Servicio', 'Precio unitario', 'Subtotal']],
      body: orden.servicios.map(s => [
        prefijoDe(s.Id_Empleado) + (s.servicio || s.Nombre || s.nombre || '—'),
        fmt(s.precio_unitario ?? s.PrecioUnitario),
        fmt(s.subtotal ?? s.Subtotal),
      ]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (orden.repuestos?.length) {
    sectionLabel(doc, 'Repuestos', M, y); y += 2.5;
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [['Repuesto', 'Cantidad', 'Precio unit.', 'Subtotal']],
      body: orden.repuestos.map(r => [
        r.repuesto || r.NombreRepuesto || r.Nombre || '—',
        r.cantidad ?? r.Cantidad ?? 1,
        fmt(r.precio_unitario ?? r.PrecioUnitario),
        fmt(r.subtotal ?? r.Subtotal),
      ]),
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  const manoDeObra   = Number(orden.ManoDeObra ?? orden.mano_de_obra ?? 0);
  const subtotalServ = (orden.servicios || []).reduce((s, x) => s + Number(x.subtotal ?? x.Subtotal ?? 0), 0);
  const subtotalRep  = (orden.repuestos || []).reduce((s, x) => s + Number(x.subtotal ?? x.Subtotal ?? 0), 0);
  const total = subtotalServ + subtotalRep + manoDeObra;

  y = summary(doc, y, [
    ['Subtotal servicios', subtotalServ],
    ['Subtotal repuestos', subtotalRep],
    ['Mano de obra', manoDeObra],
  ]) + 1;
  totalBox(doc, y, total);

  addFooter(doc);
  return doc;
}

export function generarFacturaOrden(orden, opts) {
  const doc = buildFacturaOrden(orden, opts);
  const id = orden.Id_Orden || orden.id || '?';
  doc.save(`factura-orden-${id}-${todayLocalYMD()}.pdf`);
}

/* ═══════════════ FACTURA DE COMPRA DE REPUESTOS ═══════════════ */
export function buildFacturaCompra(compra) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const id = compra.Id_Compra || compra.id || '?';

  addHeader(doc, 'Compra de repuestos', id, today());

  let y = 46;
  const filasProveedor = [
    ['Nombre', compra.Proveedor || compra.proveedor || '—'],
    ['Documento', compra.Documento || '—'],
    ['Contacto', compra.Contacto || compra.contacto || '—'],
  ];
  // N.° de factura del proveedor: referencia externa (no autogenerada), solo
  // se muestra cuando se cargó al registrar la compra.
  if (compra.NumeroFactura) filasProveedor.push(['N.° factura', compra.NumeroFactura]);
  const hProv = infoCard(doc, M, y, RIGHT - M, 'Proveedor', filasProveedor);
  y += hProv + 9;

  const detalles = compra.detalles || (compra.Repuesto ? [{
    NombreRepuesto: compra.Repuesto,
    cantidad: compra.Cantidad,
    valor_unidad: compra.PrecioUnitario,
    subtotal: Number(compra.Cantidad) * Number(compra.PrecioUnitario),
  }] : []);

  // Ganancia por línea: solo se muestra si viene calculada (precio de venta
  // vigente del repuesto menos el costo de esta compra), no siempre disponible.
  const hayGanancia = detalles.some(d => d.ganancia != null);
  sectionLabel(doc, 'Detalle de la compra', M, y); y += 2.5;
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: hayGanancia
      ? [['Repuesto', 'Cantidad', 'Precio unitario', 'Subtotal', 'Ganancia']]
      : [['Repuesto', 'Cantidad', 'Precio unitario', 'Subtotal']],
    body: detalles.map(d => {
      const cant   = Number(d.cantidad ?? d.Cantidad ?? 1);
      const precio = Number(d.valor_unidad ?? d.PrecioUnitario ?? d.Precio ?? 0);
      const sub    = d.subtotal != null ? Number(d.subtotal) : cant * precio;
      const fila = [
        d.NombreRepuesto || d.Nombre || d.Repuesto || '—',
        cant,
        fmt(precio),
        fmt(sub),
      ];
      if (hayGanancia) fila.push(d.ganancia != null ? fmt(d.ganancia) : '—');
      return fila;
    }),
    columnStyles: hayGanancia
      ? { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
      : { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });
  y = doc.lastAutoTable.finalY + 8;

  const total = Number(compra.Total ?? detalles.reduce((s, d) => {
    const cant   = Number(d.cantidad ?? d.Cantidad ?? 1);
    const precio = Number(d.valor_unidad ?? d.PrecioUnitario ?? d.Precio ?? 0);
    return s + (d.subtotal != null ? Number(d.subtotal) : cant * precio);
  }, 0));

  if (hayGanancia && compra.GananciaTotal != null) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...MUTED);
    doc.text(`Ganancia estimada: ${fmt(compra.GananciaTotal)}`, M, y + 5);
  }
  totalBox(doc, y, total);

  addFooter(doc);
  return doc;
}

export function generarFacturaCompra(compra) {
  const doc = buildFacturaCompra(compra);
  const id = compra.Id_Compra || compra.id || '?';
  doc.save(`factura-compra-${id}-${todayLocalYMD()}.pdf`);
}

/* ═══════════════ DIAGNÓSTICO (impresión desde Diagnóstico/Orden) ═══════════════ */
/* Documento enfocado SOLO en el diagnóstico: datos de cliente/vehículo, fecha y
   el texto del diagnóstico (sin precios ni ítems, eso es la factura). Acepta tanto
   una cita "Diagnosticada" como una orden. */
export function buildDiagnostico(d) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const id = d.Id ?? d.Id_Agenda ?? d.Id_Orden ?? '?';

  addHeader(doc, 'Diagnóstico', id, today());

  let y = 46;
  const colW = (RIGHT - M - 4) / 2;
  const hCli = infoCard(doc, M, y, colW, 'Cliente', [
    ['Nombre', d.Cliente || '—'],
    ['Documento', d.ClienteDoc || '—'],
    ['Teléfono', d.ClienteContacto || '—'],
  ]);
  const hVeh = infoCard(doc, M + colW + 4, y, colW, 'Vehículo', [
    ['Placa', d.Vehiculo || '—'],
    ['Marca', d.Marca || '—'],
    ['Modelo', d.Modelo || '—'],
  ]);
  y += Math.max(hCli, hVeh) + 9;

  const hDatos = infoCard(doc, M, y, RIGHT - M, 'Datos de la atención', [
    ['Fecha', formatDate(d.Fecha)],
    ['Empleado', d.Empleado || '—'],
    ...(d.Kilometraje != null && d.Kilometraje !== '' ? [['Kilometraje', `${Number(d.Kilometraje).toLocaleString('es-CO')} km`]] : []),
  ]);
  y += hDatos + 9;

  sectionLabel(doc, 'Diagnóstico', M, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...INK);
  const diag = (d.Diagnostico && String(d.Diagnostico).trim()) || 'Sin diagnóstico registrado.';
  const lines = doc.splitTextToSize(diag, RIGHT - M);
  doc.text(lines, M, y);

  addFooter(doc);
  return doc;
}

export function generarDiagnosticoPDF(d) {
  const doc = buildDiagnostico(d);
  const id = d.Id ?? d.Id_Agenda ?? d.Id_Orden ?? '?';
  doc.save(`diagnostico-${id}-${todayLocalYMD()}.pdf`);
}
