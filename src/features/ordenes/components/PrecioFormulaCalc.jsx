import React, { useState } from 'react';
import { MdCalculate } from 'react-icons/md';
import { formatCurrency } from '../../../shared/utils/helpers.js';

const IVA_PORCENTAJE = 19;

// Calculadora de precio para una línea de servicio/repuesto DENTRO de una orden
// puntual (no toca el catálogo general): el mecánico entra un costo base y un
// margen, y elige con qué fórmula facturar esa línea.
//   Valor neto           = Costo
//   Factura normal        = Costo × (1 + Margen/100)
//   Factura electrónica  = Factura normal × (1 + IVA/100)
// Al hacer clic en una fórmula, se rellena el precio_unitario/Precio de la fila
// con ese valor -- se puede seguir editando a mano después.
export default function PrecioFormulaCalc({ onAplicar, margenDefecto = 50 }) {
  const [open, setOpen] = useState(false);
  const [costo, setCosto] = useState('');
  const [margen, setMargen] = useState(String(margenDefecto));

  const c = Number(costo) || 0;
  const m = Number(margen) || 0;
  const valorNeto = c;
  const facturaNormal = c * (1 + m / 100);
  const facturaElectronica = facturaNormal * (1 + IVA_PORCENTAJE / 100);

  if (!open) {
    return (
      <button type="button" className="precio-calc__toggle" onClick={() => setOpen(true)}>
        <MdCalculate size={14} /> Calcular con fórmula (IVA / margen)
      </button>
    );
  }

  return (
    <div className="precio-calc">
      <div className="precio-calc__row">
        <input
          type="number" min="0" className="form-control form-control--sm"
          placeholder="Costo base" value={costo}
          onChange={e => setCosto(e.target.value)}
        />
        <input
          type="number" min="0" className="form-control form-control--sm"
          placeholder="Margen %" value={margen}
          onChange={e => setMargen(e.target.value)}
        />
        <button type="button" className="precio-calc__cerrar" onClick={() => setOpen(false)}>Cerrar</button>
      </div>
      <div className="precio-calc__formulas">
        <button type="button" className="precio-calc__btn" disabled={!c} onClick={() => onAplicar(valorNeto)}>
          <span>Valor neto</span>
          <strong>{formatCurrency(valorNeto)}</strong>
        </button>
        <button type="button" className="precio-calc__btn" disabled={!c} onClick={() => onAplicar(facturaNormal)}>
          <span>Factura normal</span>
          <strong>{formatCurrency(facturaNormal)}</strong>
        </button>
        <button type="button" className="precio-calc__btn" disabled={!c} onClick={() => onAplicar(facturaElectronica)}>
          <span>Factura electrónica</span>
          <strong>{formatCurrency(facturaElectronica)}</strong>
        </button>
      </div>
    </div>
  );
}
