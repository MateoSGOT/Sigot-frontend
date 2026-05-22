import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const HEADER_COLOR = [26, 26, 26];
const ACCENT_COLOR = [181, 242, 61];
const TEXT_COLOR   = [30, 30, 30];

function addHeader(doc, titulo, numero, fecha) {
  doc.setFillColor(...HEADER_COLOR);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(...ACCENT_COLOR);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('SIGOT', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(titulo, 14, 20);
  doc.setTextColor(200, 200, 200);
  doc.text(`N° ${numero}`, 130, 12);
  doc.text(`Fecha: ${fecha}`, 130, 20);
}

function addFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Gracias por su preferencia — SIGOT', 105, 290, { align: 'center' });
    doc.text(`Página ${i} de ${pageCount}`, 196, 290, { align: 'right' });
  }
}

function fmt(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(n) || 0);
}

function today() {
  return new Date().toLocaleDateString('es-CO');
}

export function generarFacturaOrden(orden) {
  console.log('[PDF] orden:', JSON.stringify(orden, null, 2));

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const id   = orden.Id_Orden || orden.id || '?';
  const fecha = today();

  addHeader(doc, 'Sistema de Gestión de Talleres', id, fecha);

  doc.setTextColor(...TEXT_COLOR);
  let y = 36;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', 14, y);
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.text(`Nombre: ${orden.Cliente || '—'}`, 14, y); y += 5;
  doc.text(`Documento: ${orden.ClienteDoc || '—'}`, 14, y); y += 5;
  doc.text(`Teléfono: ${orden.ClienteContacto || '—'}`, 14, y); y += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('VEHÍCULO', 110, 36);
  doc.setFont('helvetica', 'normal');
  doc.text(`Placa: ${orden.Vehiculo || '—'}`, 110, 42);
  doc.text(`Marca: ${orden.Marca || '—'}`, 110, 47);
  doc.text(`Modelo: ${orden.Modelo || '—'}`, 110, 52);
  doc.text(`Año: ${orden.Anio || '—'}`, 110, 57);

  y += 6;

  if (orden.servicios?.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('SERVICIOS', 14, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Servicio', 'Precio unitario', 'Subtotal']],
      body: orden.servicios.map(s => [
        s.servicio || s.Nombre || s.nombre || '—',
        fmt(s.precio_unitario ?? s.PrecioUnitario),
        fmt(s.subtotal ?? s.Subtotal),
      ]),
      theme: 'striped',
      headStyles: { fillColor: HEADER_COLOR, textColor: ACCENT_COLOR, fontStyle: 'bold' },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (orden.repuestos?.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('REPUESTOS', 14, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Repuesto', 'Cantidad', 'Precio unit.', 'Subtotal']],
      body: orden.repuestos.map(r => [
        r.repuesto || r.NombreRepuesto || r.Nombre || '—',
        r.cantidad ?? r.Cantidad ?? 1,
        fmt(r.precio_unitario ?? r.PrecioUnitario),
        fmt(r.subtotal ?? r.Subtotal),
      ]),
      theme: 'striped',
      headStyles: { fillColor: HEADER_COLOR, textColor: ACCENT_COLOR, fontStyle: 'bold' },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  const manoDeObra    = Number(orden.ManoDeObra ?? orden.mano_de_obra ?? 0);
  const subtotalServ  = (orden.servicios || []).reduce((s, x) => s + Number(x.subtotal ?? x.Subtotal ?? 0), 0);
  const subtotalRep   = (orden.repuestos || []).reduce((s, x) => s + Number(x.subtotal ?? x.Subtotal ?? 0), 0);
  const total = subtotalServ + subtotalRep + manoDeObra;

  autoTable(doc, {
    startY: y,
    body: [
      ['Mano de obra', fmt(manoDeObra)],
      ['TOTAL GENERAL', fmt(total)],
    ],
    theme: 'plain',
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 140 }, 1: { fontStyle: 'bold', halign: 'right' } },
    styles: { fontSize: 10, textColor: TEXT_COLOR },
    margin: { left: 14, right: 14 },
    didParseCell(data) {
      if (data.row.index === 1) {
        data.cell.styles.fontSize = 12;
        data.cell.styles.textColor = [0, 0, 0];
      }
    },
  });

  // Eliminar pagina en blanco extra si autoTable genero overflow innecesario
  const pageCount = doc.getNumberOfPages();
  if (pageCount > 1 && (doc.lastAutoTable?.finalY || 0) < 240) {
    doc.deletePage(pageCount);
  }

  addFooter(doc);
  const fechaStr = new Date().toISOString().split('T')[0];
  doc.save(`factura-orden-${id}-${fechaStr}.pdf`);
}

export function generarFacturaCompra(compra) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const id  = compra.Id_Compra || compra.id || '?';
  const fecha = today();

  addHeader(doc, 'Compra de Repuestos', id, fecha);

  doc.setTextColor(...TEXT_COLOR);
  let y = 36;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PROVEEDOR', 14, y);
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.text(`Nombre: ${compra.Proveedor || compra.proveedor || '—'}`, 14, y); y += 5;
  doc.text(`Documento: ${compra.Documento || '—'}`, 14, y); y += 5;
  doc.text(`Contacto: ${compra.Contacto || compra.contacto || '—'}`, 14, y); y += 8;

  const detalles = compra.detalles || (compra.Repuesto ? [{ NombreRepuesto: compra.Repuesto, cantidad: compra.Cantidad, valor_unidad: compra.PrecioUnitario, subtotal: Number(compra.Cantidad) * Number(compra.PrecioUnitario) }] : []);

  autoTable(doc, {
    startY: y,
    head: [['Repuesto', 'Cantidad', 'Precio unitario', 'Subtotal']],
    body: detalles.map(d => [
      d.NombreRepuesto || d.Nombre || '—',
      d.cantidad ?? d.Cantidad ?? 1,
      fmt(d.valor_unidad ?? d.PrecioUnitario),
      fmt(d.subtotal ?? (Number(d.cantidad ?? 1) * Number(d.valor_unidad ?? 0))),
    ]),
    theme: 'striped',
    headStyles: { fillColor: HEADER_COLOR, textColor: ACCENT_COLOR, fontStyle: 'bold' },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 8;
  const total = Number(compra.Total || detalles.reduce((s, d) => s + Number(d.subtotal ?? 0), 0));
  autoTable(doc, {
    startY: y,
    body: [['TOTAL', fmt(total)]],
    theme: 'plain',
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 140 }, 1: { fontStyle: 'bold', halign: 'right', fontSize: 12 } },
    styles: { fontSize: 10, textColor: TEXT_COLOR },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  if (pageCount > 1 && (doc.lastAutoTable?.finalY || 0) < 240) {
    doc.deletePage(pageCount);
  }

  addFooter(doc);
  const fechaStr = new Date().toISOString().split('T')[0];
  doc.save(`factura-compra-${id}-${fechaStr}.pdf`);
}
