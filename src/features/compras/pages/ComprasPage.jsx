import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdBlock, MdDeleteOutline, MdWarning } from 'react-icons/md';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh.js';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import { fetchCompras, createCompra, anularCompra } from '../slices/comprasSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import ConfirmDialog from '../../../shared/components/ConfirmDialog/ConfirmDialog.jsx';
import Badge from '../../../shared/components/Badge/Badge.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { filterItems, sortNewestFirst, formatDate, formatCurrency, todayLocalYMD } from '../../../shared/utils/helpers.js';
import { generarFacturaCompra } from '../../../shared/utils/generarFacturaPDF.js';
import api from '../../../shared/services/api.js';
import './ComprasPage.css';

const EMPTY_ITEM = { Id_Repuesto: '', Cantidad: '', PrecioUnitario: '' };
const newForm = () => ({ Id_Proveedor: '', Fecha: todayLocalYMD(), NumeroFactura: '', productos: [{ ...EMPTY_ITEM }] });

export default function ComprasPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.compras);
  const puedeCrear  = usePermiso('COMPRAS.REGISTRAR');
  const puedeAnular = usePermiso('COMPRAS.ANULAR');
  const [proveedores, setProveedores] = useState([]);
  const [repuestos, setRepuestos] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [pageSize, setPageSize] = useState(5);
  const [detailItem, setDetailItem] = useState(null);
  const [formData, setFormData] = useState(newForm());
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [priceWarnings, setPriceWarnings] = useState({});
  const [confirmAnular, setConfirmAnular] = useState(null);

  useEffect(() => {
    dispatch(fetchCompras());
    // Solo proveedores activos: un proveedor inactivo no debe poder recibir compras nuevas.
    api.get('/api/proveedores?estado=activos')
      .then(r => {
        const data = r.data?.data || r.data || [];
        setProveedores(data.filter(p => p.Estado !== false && p.Estado !== 0));
      })
      .catch(() => {});
    api.get('/api/repuestos').then(r => setRepuestos(r.data?.data || r.data || [])).catch(() => {});
  }, [dispatch]);

  useAutoRefresh(() => dispatch(fetchCompras()), { intervalMs: 20000, enabled: !showForm && !confirmAnular });

  const getNombre = (arr, idKey, id) => {
    const lowKey = idKey === 'Id_Proveedor' ? 'id_proveedor' : idKey;
    const item = arr.find(x => x[idKey] === Number(id) || x[idKey] === id || x[lowKey] === Number(id) || x[lowKey] === id);
    return item ? (item.Nombre ?? item.nombre ?? `#${id}`) : `#${id}`;
  };

  const repuestosFiltrados = repuestos;

  // Agrupa los productos de una misma compra: por N.° de factura si lo tiene
  // (confiable), o por proveedor + misma fecha como respaldo para compras
  // viejas sin ese dato (antes era la única forma de agrupar, y mezclaba dos
  // compras reales al mismo proveedor el mismo día).
  const detailItems = detailItem
    ? items.filter(i =>
        i.Id_Proveedor === detailItem.Id_Proveedor &&
        (detailItem.NumeroFactura
          ? i.NumeroFactura === detailItem.NumeroFactura
          : !i.NumeroFactura && (i.Fecha || '').split('T')[0] === (detailItem.Fecha || '').split('T')[0])
      )
    : [];

  const detailTotal = detailItems.reduce((s, i) => s + Number(i.Cantidad || 0) * Number(i.PrecioUnitario || 0), 0);

  // Ganancia estimada por línea: precio de venta VIGENTE del repuesto (ya
  // incluye margen + IVA) menos el costo de ESTA compra. No es exactamente lo
  // que se ganará en cada venta futura si el repuesto tuvo compras más
  // recientes que cambiaron su costo/margen, pero da una referencia real de
  // cuánto deja cada compra al precio actual.
  const gananciaLinea = (row) => {
    const rep = repuestos.find(r => String(r.Id_Repuesto) === String(row.Id_Repuesto));
    if (!rep || rep.PrecioVenta == null) return null;
    return (Number(rep.PrecioVenta) - Number(row.PrecioUnitario || 0)) * Number(row.Cantidad || 0);
  };
  const gananciaTotalDetalle = detailItems.reduce((s, i) => s + (gananciaLinea(i) || 0), 0);

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activas') list = list.filter(i => !i.Anulada);
    else if (statusFilter === 'anuladas') list = list.filter(i => i.Anulada);
    return sortNewestFirst(filterItems(list, search, ['Proveedor', 'Repuesto']), 'Id_Compra');
  })();

  const openCreate = () => { setFormData(newForm()); setFormError(''); setPriceWarnings({}); setShowForm(true); };

  const handleFormChange = e => {
    const { name, value } = e.target;
    setFormData(p => {
      const next = { ...p, [name]: value };
      if (name === 'Id_Proveedor') {
        next.productos = [{ ...EMPTY_ITEM }];
        setPriceWarnings({});
      }
      return next;
    });
  };

  const handleItemChange = (idx, field, value) => {
    setFormData(p => {
      const productos = [...p.productos];
      productos[idx] = { ...productos[idx], [field]: value };

      if (field === 'Id_Repuesto') {
        const repuesto = repuestos.find(r => String(r.Id_Repuesto) === String(value));
        const precioRef = repuesto?.PrecioCompra ?? repuesto?.Precio;
        if (repuesto && precioRef !== undefined) {
          productos[idx] = { ...productos[idx], PrecioUnitario: String(precioRef) };
        } else {
          productos[idx] = { ...productos[idx], PrecioUnitario: '' };
        }
        // Autocompleta la cantidad con 1 si aún no se había puesto ninguna: sin esto,
        // el botón "Registrar" seguía deshabilitado tras elegir el repuesto y parecía
        // que el select "no hacía nada" hasta tocar otro campo.
        if (!productos[idx].Cantidad) {
          productos[idx] = { ...productos[idx], Cantidad: '1' };
        }
        setPriceWarnings(prev => { const next = { ...prev }; delete next[idx]; return next; });
      }

      if (field === 'PrecioUnitario') {
        const item = productos[idx];
        const repuesto = repuestos.find(r => String(r.Id_Repuesto) === String(item.Id_Repuesto));
        const precioRef = repuesto?.PrecioCompra ?? repuesto?.Precio;
        if (repuesto && precioRef !== undefined && value && Number(value) !== Number(precioRef)) {
          setPriceWarnings(prev => ({ ...prev, [idx]: { esperado: precioRef, ingresado: value } }));
        } else {
          setPriceWarnings(prev => { const next = { ...prev }; delete next[idx]; return next; });
        }
      }

      return { ...p, productos };
    });
  };

  const addItem = () => setFormData(p => ({ ...p, productos: [...p.productos, { ...EMPTY_ITEM }] }));

  const removeItem = idx => {
    setFormData(p => ({ ...p, productos: p.productos.filter((_, i) => i !== idx) }));
    setPriceWarnings(prev => {
      const next = {};
      Object.keys(prev).forEach(k => { if (Number(k) !== idx) next[Number(k) > idx ? Number(k) - 1 : k] = prev[k]; });
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.Id_Proveedor || !formData.Fecha) { setFormError('Completa proveedor y fecha.'); return; }
    for (const item of formData.productos) {
      if (!item.Id_Repuesto || !item.Cantidad || !item.PrecioUnitario) {
        setFormError('Completa todos los campos de cada producto.');
        return;
      }
    }
    setFormError('');
    for (const item of formData.productos) {
      const result = await dispatch(createCompra({
        Id_Proveedor: formData.Id_Proveedor,
        Id_Repuesto: item.Id_Repuesto,
        Cantidad: item.Cantidad,
        PrecioUnitario: item.PrecioUnitario,
        Fecha: formData.Fecha,
        NumeroFactura: formData.NumeroFactura,
      }));
      if (result.error) {
        setFormError(result.payload || 'Error al registrar compra.');
        return;
      }
    }
    setShowForm(false);
    dispatch(fetchCompras());
  };

  const handleConfirmAnular = async () => {
    if (!confirmAnular) return;
    const result = await dispatch(anularCompra(confirmAnular.Id_Compra));
    if (!result.error) setConfirmAnular(null);
  };

  const grandTotal = formData.productos.reduce(
    (sum, i) => sum + Number(i.Cantidad || 0) * Number(i.PrecioUnitario || 0), 0
  );

  // Validez en tiempo real: habilita "Guardar" solo cuando todo está completo.
  const compraValida = !!formData.Id_Proveedor && !!formData.Fecha
    && formData.productos.length > 0
    && formData.productos.every(it => it.Id_Repuesto && Number(it.Cantidad) > 0 && Number(it.PrecioUnitario) >= 0 && it.PrecioUnitario !== '');

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Proveedor', label: 'Proveedor', render: (v, row) => v || getNombre(proveedores, 'Id_Proveedor', row.Id_Proveedor) },
    { key: 'Repuesto', label: 'Repuesto', render: (v, row) => v || getNombre(repuestos, 'Id_Repuesto', row.Id_Repuesto) },
    { key: 'Cantidad', label: 'Cantidad' },
    { key: 'PrecioUnitario', label: 'Precio unitario', render: v => formatCurrency(v) },
    { key: 'total', label: 'Total', render: (_, row) => formatCurrency(Number(row.Cantidad || 0) * Number(row.PrecioUnitario || 0)) },
    { key: 'Fecha', label: 'Fecha', render: v => formatDate(v) },
    { key: 'NumeroFactura', label: 'N.° factura', render: v => v || '—' },
    {
      key: 'Anulada', label: 'Estado', render: v =>
        v ? <Badge variant="gray">Anulada</Badge> : <Badge variant="success">Vigente</Badge>
    },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" title="Ver detalle" onClick={() => setDetailItem(row)}>
            <MdVisibility size={17} />
          </button>
          {!row.Anulada && (
            <button className="btn btn--ghost btn--icon btn--sm compra-anular-btn" title="Anular compra" disabled={!puedeAnular} onClick={() => setConfirmAnular(row)}>
              <MdBlock size={17} />
            </button>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Compras</h1>
          <p className="page__subtitle">{items.length} compra(s) registrada(s)</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Registrar compra</button>
      </div>

      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por proveedor, repuesto..."
            filterSlot={
              <FilterDropdown
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                statusOptions={[
                  { value: 'todas', label: 'Todas' },
                  { value: 'activas', label: 'Vigentes' },
                  { value: 'anuladas', label: 'Anuladas' },
                ]}
              />
            }
          />
        </div>
        <Table columns={columns} rowKey="Id_Compra" data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron compras" />
      </div>

      {/* Modal de detalle — muestra TODOS los productos de esa compra */}
      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Detalle de la compra" size="lg"
        footer={detailItem ? <button className="btn btn--primary" onClick={() => generarFacturaCompra({
          ...detailItem,
          Proveedor: detailItem.Proveedor || getNombre(proveedores, 'Id_Proveedor', detailItem.Id_Proveedor),
          // Mapeamos cada producto a los nombres de campo que espera el PDF y
          // resolvemos el nombre del repuesto desde el catálogo cargado.
          detalles: detailItems.map(d => ({
            NombreRepuesto: d.Repuesto || getNombre(repuestos, 'Id_Repuesto', d.Id_Repuesto),
            cantidad:     Number(d.Cantidad || 0),
            valor_unidad: Number(d.PrecioUnitario || 0),
            subtotal:     Number(d.Cantidad || 0) * Number(d.PrecioUnitario || 0),
            ganancia:     gananciaLinea(d),
          })),
          Total: detailTotal,
          GananciaTotal: gananciaTotalDetalle,
        })}>Factura (PDF)</button> : null}
      >
        {detailItem && (
          <div>
            <div className="detail-grid u-mb-xl">
              <div className="detail-item"><span className="detail-label">Proveedor</span><span className="detail-value">{detailItem.Proveedor || getNombre(proveedores, 'Id_Proveedor', detailItem.Id_Proveedor)}</span></div>
              <div className="detail-item"><span className="detail-label">Fecha</span><span className="detail-value">{formatDate(detailItem.Fecha)}</span></div>
              <div className="detail-item"><span className="detail-label">N.° factura</span><span className="detail-value">{detailItem.NumeroFactura || '—'}</span></div>
              <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value">{detailItem.Anulada ? <Badge variant="gray">Anulada</Badge> : <Badge variant="success">Vigente</Badge>}</span></div>
            </div>
            <h4 className="compra-detail__subhead">Productos ({detailItems.length})</h4>
            <div className="compra-detail__scroll">
              <table className="compra-detail-table">
                <thead>
                  <tr>
                    {['Repuesto', 'Cantidad', 'Precio unitario', 'Subtotal', 'Ganancia'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailItems.map((row, i) => {
                    const ganancia = gananciaLinea(row);
                    return (
                      <tr key={i}>
                        <td>{row.Repuesto || getNombre(repuestos, 'Id_Repuesto', row.Id_Repuesto)}</td>
                        <td>{row.Cantidad}</td>
                        <td>{formatCurrency(row.PrecioUnitario)}</td>
                        <td className="is-total">{formatCurrency(Number(row.Cantidad) * Number(row.PrecioUnitario))}</td>
                        <td>{ganancia != null ? formatCurrency(ganancia) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="compra-detail__total">
              <span className="compra-detail__total-value">Total: {formatCurrency(detailTotal)}</span>
              <span className="compra-detail__total-value">Ganancia estimada: {formatCurrency(gananciaTotalDetalle)}</span>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de registro */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Registrar compra"
        size="lg"
        footer={
          <>
            <button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading || !compraValida}>
              {actionLoading ? 'Guardando...' : 'Registrar'}
            </button>
          </>
        }
      >
        {formError && (
          <div className="form-error-box u-mb-lg">{formError}</div>
        )}
        <form className="compra-form" onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Proveedor <span className="required">*</span></label>
              <SearchableSelect
                options={proveedores.map(p => { const pid = p.Id_Proveedor ?? p.id_proveedor; return { value: String(pid), label: p.Nombre ?? p.nombre }; })}
                value={String(formData.Id_Proveedor)}
                onChange={v => { setFormData(p => ({ ...p, Id_Proveedor: v, productos: [{ ...EMPTY_ITEM }] })); setPriceWarnings({}); }}
                placeholder="Seleccionar proveedor..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha <span className="required">*</span></label>
              <input name="Fecha" type="date" className="form-control" value={formData.Fecha} onChange={handleFormChange} />
            </div>
            <div className="form-group">
              <label className="form-label">N.° de factura <span className="u-hint-sm">(opcional)</span></label>
              <input name="NumeroFactura" type="text" maxLength={50} className="form-control" value={formData.NumeroFactura} onChange={handleFormChange} placeholder="Ej. FV-00123" />
            </div>
          </div>

          <div className="compra-productos">
            <div className="compra-productos__header">
              <span>Repuesto</span>
              <span>Cantidad</span>
              <span>Precio unitario</span>
              <span>Subtotal</span>
              <span></span>
            </div>
            {formData.productos.map((item, idx) => (
              <div key={idx}>
                <div className="compra-producto-row">
                  <div className="compra-field">
                    <span className="compra-field-label">Repuesto</span>
                    <SearchableSelect
                      options={repuestosFiltrados.map(r => ({ value: String(r.Id_Repuesto), label: r.NombreRepuesto ?? r.Nombre }))}
                      value={String(item.Id_Repuesto)}
                      onChange={v => handleItemChange(idx, 'Id_Repuesto', v)}
                      placeholder="Seleccionar repuesto..."
                    />
                  </div>
                  <div className="compra-field">
                    <span className="compra-field-label">Cantidad</span>
                    <input
                      type="number"
                      min="1"
                      className="form-control form-control--sm"
                      value={item.Cantidad}
                      onChange={e => handleItemChange(idx, 'Cantidad', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="compra-field">
                    <span className="compra-field-label">Precio unitario</span>
                    <div className="price-input-wrap">
                      <input
                        type="number"
                        min="0"
                        className={`form-control form-control--sm${priceWarnings[idx] ? ' form-control--warn' : ''}`}
                        value={item.PrecioUnitario}
                        onChange={e => handleItemChange(idx, 'PrecioUnitario', e.target.value)}
                        placeholder="0"
                      />
                      {item.PrecioUnitario && !priceWarnings[idx] ? <small className="price-preview">{formatCurrency(item.PrecioUnitario)}</small> : null}
                    </div>
                  </div>
                  <div className="compra-field">
                    <span className="compra-field-label">Subtotal</span>
                    <span className="compra-subtotal">
                      {formatCurrency(Number(item.Cantidad || 0) * Number(item.PrecioUnitario || 0))}
                    </span>
                  </div>
                  <div className="compra-field compra-field--action">
                    <button
                      type="button"
                      className="btn btn--ghost btn--icon btn--sm compra-remove-btn"
                      disabled={formData.productos.length === 1}
                      onClick={() => removeItem(idx)}
                      title="Eliminar fila"
                    >
                      <MdDeleteOutline size={17} />
                    </button>
                  </div>
                </div>
                {priceWarnings[idx] && (
                  <div className="price-warning">
                    <MdWarning size={14} />
                    El precio de compra registrado para este repuesto es {formatCurrency(priceWarnings[idx].esperado)}.
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="compra-form-footer">
            <button type="button" className="btn btn--outline btn--sm" onClick={addItem}>
              <MdAdd size={16} /> Agregar producto
            </button>
            <div className="compra-total">
              <span className="compra-total__label">Total</span>
              <span className="compra-total__value">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmAnular}
        onClose={() => setConfirmAnular(null)}
        onConfirm={handleConfirmAnular}
        title="Anular compra"
        message={`¿Estás seguro de anular la compra de "${confirmAnular?.Repuesto || 'este repuesto'}"? El stock se revertirá y esta acción no se puede deshacer.`}
        confirmLabel="Sí, anular"
        danger
        loading={actionLoading}
      />
    </div>
  );
}

