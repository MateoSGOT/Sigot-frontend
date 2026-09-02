import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { todayLocalYMD } from './helpers.js';

/* ═══════════════════════════════════════════════════════════════════
   Facturas SIGOT — diseño alineado con la marca de la app
   (azul marino → esmeralda, tarjetas suaves, acentos verdes).
   ═══════════════════════════════════════════════════════════════════ */

// Paleta (RGB) tomada del rediseño de la página
const NAVY    = [14, 26, 44];     // #0e1a2c  banda superior
const EMERALD = [22, 163, 74];    // #16a34a  acento principal
const MINT    = [74, 222, 128];   // #4ade80  acento claro
const INK     = [17, 24, 39];     // texto principal
const MUTED   = [107, 114, 128];  // texto secundario
const LINE    = [229, 231, 235];  // bordes
const SOFT    = [244, 246, 248];  // fondos suaves / filas alternas
const WHITE   = [255, 255, 255];
const ONNAVY  = [205, 212, 224];  // texto tenue sobre la banda navy

const PAGE_W = 210;
const M = 14;                     // margen lateral
const RIGHT = PAGE_W - M;         // 196

const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
    .format(Number(n) || 0);

const today = () => new Date().toLocaleDateString('es-CO');

/* ── Encabezado: banda navy + wordmark + franja esmeralda ── */
function addHeader(doc, tipo, numero, fecha) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 34, 'F');
  doc.setFillColor(...EMERALD);
  doc.rect(0, 34, PAGE_W, 1.6, 'F');

  // Wordmark
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SIGOT', M, 16);
  // subrayado mint bajo el wordmark
  doc.setFillColor(...MINT);
  doc.roundedRect(M, 19, 22, 1.2, 0.6, 0.6, 'F');
  // tipo de documento
  doc.setTextColor(...MINT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(tipo, M, 27);

  // Derecha: número y fecha
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`N° ${numero}`, RIGHT, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...ONNAVY);
  doc.text(`Fecha: ${fecha}`, RIGHT, 22, { align: 'right' });
}

/* ── Tarjeta de información (Proveedor / Cliente / Vehículo) ── */
function infoCard(doc, x, y, w, title, rows) {
  const padX = 7, padTop = 6, lineH = 5.4;
  const h = padTop + 5 + rows.length * lineH + 2.5;

  doc.setFillColor(...SOFT);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');
  // acento izquierdo esmeralda (recto para no salir del redondeo)
  doc.setFillColor(...EMERALD);
  doc.rect(x, y + 2.5, 1.8, h - 5, 'F');

  doc.setTextColor(...EMERALD);
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
  doc.setTextColor(...EMERALD);
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

/* ── Caja de TOTAL (esmeralda, a la derecha) ── */
function totalBox(doc, y, amount) {
  const boxW = 82, x = RIGHT - boxW, h = 14;
  doc.setFillColor(...EMERALD);
  doc.roundedRect(x, y, boxW, h, 2.5, 2.5, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('TOTAL', x + 7, y + h / 2, { baseline: 'middle' });
  doc.setFontSize(14);
  doc.text(fmt(amount), RIGHT - 7, y + h / 2, { align: 'right', baseline: 'middle' });
  return y + h;
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

/* Estilos de tabla compartidos (cabecera esmeralda, filas alternas suaves) */
const tableBase = {
  theme: 'striped',
  headStyles: { fillColor: EMERALD, textColor: WHITE, fontStyle: 'bold', fontSize: 9.5, cellPadding: 3 },
  bodyStyles: { fontSize: 9.5, textColor: INK, cellPadding: 2.8 },
  alternateRowStyles: { fillColor: SOFT },
  styles: { lineColor: LINE, lineWidth: 0.1 },
  margin: { left: M, right: M },
};

/* ═══════════════ FACTURA DE ORDEN DE TRABAJO ═══════════════ */
export function buildFacturaOrden(orden) {
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
        s.servicio || s.Nombre || s.nombre || '—',
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

export function generarFacturaOrden(orden) {
  const doc = buildFacturaOrden(orden);
  const id = orden.Id_Orden || orden.id || '?';
  doc.save(`factura-orden-${id}-${todayLocalYMD()}.pdf`);
}

/* ═══════════════ FACTURA DE COMPRA DE REPUESTOS ═══════════════ */
export function buildFacturaCompra(compra) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const id = compra.Id_Compra || compra.id || '?';

  addHeader(doc, 'Compra de repuestos', id, today());

  let y = 46;
  const hProv = infoCard(doc, M, y, RIGHT - M, 'Proveedor', [
    ['Nombre', compra.Proveedor || compra.proveedor || '—'],
    ['Documento', compra.Documento || '—'],
    ['Contacto', compra.Contacto || compra.contacto || '—'],
  ]);
  y += hProv + 9;

  const detalles = compra.detalles || (compra.Repuesto ? [{
    NombreRepuesto: compra.Repuesto,
    cantidad: compra.Cantidad,
    valor_unidad: compra.PrecioUnitario,
    subtotal: Number(compra.Cantidad) * Number(compra.PrecioUnitario),
  }] : []);

  sectionLabel(doc, 'Detalle de la compra', M, y); y += 2.5;
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [['Repuesto', 'Cantidad', 'Precio unitario', 'Subtotal']],
    body: detalles.map(d => {
      const cant   = Number(d.cantidad ?? d.Cantidad ?? 1);
      const precio = Number(d.valor_unidad ?? d.PrecioUnitario ?? d.Precio ?? 0);
      const sub    = d.subtotal != null ? Number(d.subtotal) : cant * precio;
      return [
        d.NombreRepuesto || d.Nombre || d.Repuesto || '—',
        cant,
        fmt(precio),
        fmt(sub),
      ];
    }),
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });
  y = doc.lastAutoTable.finalY + 8;

  const total = Number(compra.Total ?? detalles.reduce((s, d) => {
    const cant   = Number(d.cantidad ?? d.Cantidad ?? 1);
    const precio = Number(d.valor_unidad ?? d.PrecioUnitario ?? d.Precio ?? 0);
    return s + (d.subtotal != null ? Number(d.subtotal) : cant * precio);
  }, 0));
  totalBox(doc, y, total);

  addFooter(doc);
  return doc;
}

export function generarFacturaCompra(compra) {
  const doc = buildFacturaCompra(compra);
  const id = compra.Id_Compra || compra.id || '?';
  doc.save(`factura-compra-${id}-${todayLocalYMD()}.pdf`);
}
