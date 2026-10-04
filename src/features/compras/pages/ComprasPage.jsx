import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdBlock, MdDeleteOutline, MdWarning } from 'react-icons/md';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import { createCompra, anularCompra } from '../slices/comprasSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import ConfirmDialog from '../../../shared/components/ConfirmDialog/ConfirmDialog.jsx';
import Badge from '../../../shared/components/Badge/Badge.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { formatDate, formatCurrency, todayLocalYMD } from '../../../shared/utils/helpers.js';
import { generarFacturaCompra } from '../../../shared/utils/generarFacturaPDF.js';
import api from '../../../shared/services/api.js';
import { MAQUETA_FILAS_COMPRAS, MAQUETA_DETALLE_COMPRA } from '../../../shared/dev/datosMaqueta.js';

/* La puerta se evalua AQUI, no se importa, y la diferencia no es de estilo.
   Importada desde datosMaqueta.js, MAQUETA_ACTIVA es una const de OTRO modulo:
   Vite sustituye import.meta.env.DEV por `false` dentro de ese modulo, pero no
   propaga el valor plegado a traves del limite del import, asi que el `if` de
   aca nunca se declaraba muerto y los datos de maqueta seguian referenciados.
   Resultado comprobado en dist/: un chunk datosMaqueta de 3,9 KB con nombres,
   placas y precios inventados, importado por esta pagina en PRODUCCION -- justo
   lo que el comentario del modulo decia que no podia pasar.
   Escrita en este archivo, las dos lecturas de import.meta.env se reemplazan por
   literales al compilar, la expresion se pliega a `false` y la rama (con sus
   referencias a los datos) desaparece junto con el chunk. */
const MAQUETA_ACTIVA = import.meta.env.DEV && import.meta.env.VITE_DEV_SKIP_AUTH === 'true';

/* ── Clases del modulo de compras ──────────────────────────────────────────
   Antes en ComprasPage.css. Se conservan los valores exactos.

   LA REJILLA DE PRODUCTOS es la pieza con truco: en escritorio cada campo usa
   `display: contents`, asi sus controles caen directo en las 6 columnas del
   padre y las lineas quedan alineadas entre si. Por debajo de 640px el mismo
   campo pasa a ser un bloque con su etiqueta visible, y la fila se vuelve una
   sola columna. Es el equivalente, para un formulario, de lo que Table.css hace
   con las tablas.

   El umbral sigue siendo 640px de VIEWPORT (max-sm:, que en Tailwind es
   max-width 639.98px) y no una consulta de contenedor: este formulario vive
   dentro de un Modal, cuyo ancho ya depende del viewport. Cambiarlo a
   @container obligaria a recalibrar el numero contra el ancho del modal, que es
   justo el error que se cometio una vez con la tabla del dashboard. */
const COLUMNAS = 'grid-cols-[2fr_1fr_1.2fr_1fr_1.1fr_36px]';
const CABECERA_PRODUCTOS = `grid ${COLUMNAS} gap-sm border-b-[1.5px] border-border bg-surface-solid px-md py-sm text-[0.72rem] font-bold tracking-[0.04em] text-text-muted max-sm:hidden`;
const FILA_PRODUCTO = `grid ${COLUMNAS} items-start gap-sm border-b border-border px-md py-sm last:border-b-0 max-sm:grid-cols-1 max-sm:gap-md max-sm:p-lg`;
const CAMPO = 'contents max-sm:flex max-sm:flex-col max-sm:gap-[0.3rem]';
const ETIQUETA_CAMPO = 'hidden max-sm:block text-[0.72rem] font-bold uppercase tracking-[0.04em] text-text-muted';

/* Controles reducidos dentro de la rejilla. Ya no necesitan !important: las
   hojas compartidas viven en @layer components, asi que una utilidad les gana. */
const CONTROL_SM = 'form-control px-[0.625rem] py-[0.375rem] text-[0.8125rem]';
const CONTROL_SM_AVISO = `${CONTROL_SM} border-accent/60 bg-accent/5`;
const PREVIO_PRECIO = 'mt-[3px] whitespace-nowrap pl-[2px] text-[0.7rem] font-semibold text-text-secondary';

/* Tabla del detalle de la compra: se apila en tarjetas igual que la tabla
   compartida en vez de obligar a scroll horizontal en el celular. */
const TABLA_DETALLE = 'w-full border-collapse text-body '
  + '[&_th]:border-b [&_th]:border-border [&_th]:px-md [&_th]:py-sm [&_th]:text-left [&_th]:text-small [&_th]:font-semibold [&_th]:text-text-muted '
  + '[&_td]:border-b [&_td]:border-border [&_td]:px-md [&_td]:py-sm '
  + '[&_td.is-total]:font-semibold';
const TABLA_DETALLE_MOVIL = 'max-sm:block '
  + '[&_thead]:max-sm:hidden [&_tbody]:max-sm:block [&_tr]:max-sm:block '
  + '[&_tbody_tr]:max-sm:mb-md [&_tbody_tr]:max-sm:rounded-md [&_tbody_tr]:max-sm:border [&_tbody_tr]:max-sm:border-border [&_tbody_tr]:max-sm:px-[0.875rem] [&_tbody_tr]:max-sm:py-xs '
  + '[&_td]:max-sm:flex [&_td]:max-sm:items-center [&_td]:max-sm:justify-between [&_td]:max-sm:gap-lg [&_td]:max-sm:border-0 [&_td]:max-sm:border-t [&_td]:max-sm:border-border-light [&_td]:max-sm:px-0 [&_td]:max-sm:py-[0.55rem] [&_td]:max-sm:text-right '
  + "[&_td]:max-sm:before:content-[attr(data-label)] [&_td]:max-sm:before:shrink-0 [&_td]:max-sm:before:text-[0.68rem] [&_td]:max-sm:before:font-bold [&_td]:max-sm:before:uppercase [&_td]:max-sm:before:tracking-wide [&_td]:max-sm:before:text-text-muted [&_td]:max-sm:before:text-left "
  + '[&_tr_td:first-child]:max-sm:border-t-0';

const EMPTY_ITEM = { Id_Repuesto: '', Cantidad: '', PrecioUnitario: '', DescuentoPorcentaje: '' };
const newForm = () => ({ Id_Proveedor: '', Fecha: todayLocalYMD(), NumeroFactura: '', productos: [{ ...EMPTY_ITEM }] });

export default function ComprasPage() {
  const dispatch = useDispatch();
  const { actionLoading } = useSelector(s => s.compras);
  const puedeCrear  = usePermiso('COMPRAS.REGISTRAR');
  const puedeAnular = usePermiso('COMPRAS.ANULAR');
  const [proveedores, setProveedores] = useState([]);
  const [repuestos, setRepuestos] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [pageSize, setPageSize] = useState(5);
  // Estado del listado SERVER-SIDE (mismo patrón que RepuestosPage).
  const [page, setPage]         = useState(1);
  const [rows, setRows]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [detailItem, setDetailItem] = useState(null);
  // Una "compra" con varios productos crea VARIAS filas de Compras (una por producto),
  // agrupadas por N.° de factura para mostrarlas juntas -- el detalle necesita el grupo
  // COMPLETO, no solo lo que haya caído en la página visible de la tabla. Se pide aparte,
  // solo al abrir el detalle (no en cada carga de la lista).
  const [detailGroup, setDetailGroup] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formData, setFormData] = useState(newForm());
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [priceWarnings, setPriceWarnings] = useState({});
  const [confirmAnular, setConfirmAnular] = useState(null);

  const fetchPage = useCallback(async () => {
    setListLoading(true);
    try {
      const ps = pageSize === 'all' ? 9999 : pageSize;
      const estadoParam = statusFilter === 'activas' ? 'activos' : statusFilter === 'anuladas' ? 'inactivos' : 'todos';
      const params = new URLSearchParams({ page: String(page), pageSize: String(ps), estado: estadoParam });
      if (search) params.set('search', search);
      const r = await api.get(`/api/compras?${params.toString()}`);
      setRows(r.data?.data || []);
      setTotal(r.data?.total ?? 0);
    } catch {
      // Igual que en Repuestos: sin sesion la tabla queda vacia y no hay forma de
      // revisar la insignia de anulada, el detalle ni el colapso a tarjetas.
      if (MAQUETA_ACTIVA) { setRows(MAQUETA_FILAS_COMPRAS); setTotal(MAQUETA_FILAS_COMPRAS.length); }
      else { setRows([]); setTotal(0); }
    }
    finally { setListLoading(false); }
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {
    // Solo proveedores activos: un proveedor inactivo no debe poder recibir compras nuevas.
    api.get('/api/proveedores?estado=activos')
      .then(r => {
        const data = r.data?.data || r.data || [];
        setProveedores(data.filter(p => p.Estado !== false && p.Estado !== 0));
      })
      .catch(() => {});
    api.get('/api/repuestos').then(r => setRepuestos(r.data?.data || r.data || [])).catch(() => {});
  }, []);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  const onSearch   = (v) => { setSearch(v); setPage(1); };
  const onStatus   = (v) => { setStatusFilter(v); setPage(1); };
  const onPageSize = (v) => { setPageSize(v); setPage(1); };


  const getNombre = (arr, idKey, id) => {
    const lowKey = idKey === 'Id_Proveedor' ? 'id_proveedor' : idKey;
    const item = arr.find(x => x[idKey] === Number(id) || x[idKey] === id || x[lowKey] === Number(id) || x[lowKey] === id);
    return item ? (item.Nombre ?? item.nombre ?? `#${id}`) : `#${id}`;
  };

  const repuestosFiltrados = repuestos;

  // Agrupa los productos de una misma compra: por N.° de factura si lo tiene
  // (confiable), o por proveedor + misma fecha como respaldo para compras
  // viejas sin ese dato (antes era la única forma de agrupar, y mezclaba dos
  // compras reales al mismo proveedor el mismo día). El grupo puede caer en más de
  // una página de la tabla, así que se resuelve aparte (ver openDetail) contra la
  // lista completa, no contra `rows` (la página visible).
  const detailItems = detailGroup;

  // Trae la lista completa (mismo endpoint sin ?page -- compatibilidad) SOLO al abrir un
  // detalle, y arma el grupo de esa factura/compra. No se hace en cada carga de la tabla.
  const openDetail = async (row) => {
    setDetailItem(row);
    setDetailGroup([row]); // fallback inmediato mientras carga
    setDetailLoading(true);
    try {
      const r = await api.get('/api/compras');
      const all = r.data?.data || r.data || [];
      setDetailGroup(all.filter(i =>
        i.Id_Proveedor === row.Id_Proveedor &&
        (row.NumeroFactura
          ? i.NumeroFactura === row.NumeroFactura
          : !i.NumeroFactura && (i.Fecha || '').split('T')[0] === (row.Fecha || '').split('T')[0])
      ));
    } catch {
      if (MAQUETA_ACTIVA) setDetailGroup(MAQUETA_DETALLE_COMPRA);
      /* si no, se queda con el fallback [row] */
    }
    finally { setDetailLoading(false); }
  };

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
        productos[idx] = { ...productos[idx], DescuentoPorcentaje: '' };
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
        DescuentoPorcentaje: item.DescuentoPorcentaje || 0,
      }));
      if (result.error) {
        setFormError(result.payload || 'Error al registrar compra.');
        return;
      }
    }
    setShowForm(false);
    fetchPage();
  };

  const handleConfirmAnular = async () => {
    if (!confirmAnular) return;
    const result = await dispatch(anularCompra(confirmAnular.Id_Compra));
    if (!result.error) { setConfirmAnular(null); fetchPage(); }
  };

  const grandTotal = formData.productos.reduce(
    (sum, i) => sum + Number(i.Cantidad || 0) * Number(i.PrecioUnitario || 0), 0
  );

  // Validez en tiempo real: habilita "Guardar" solo cuando todo está completo.
  const compraValida = !!formData.Id_Proveedor && !!formData.Fecha
    && formData.productos.length > 0
    && formData.productos.every(it => it.Id_Repuesto && Number(it.Cantidad) > 0 && Number(it.PrecioUnitario) >= 0 && it.PrecioUnitario !== ''
      && (it.DescuentoPorcentaje === '' || (Number(it.DescuentoPorcentaje) >= 0 && Number(it.DescuentoPorcentaje) <= 100)));

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Proveedor', label: 'Proveedor', render: (v, row) => v || getNombre(proveedores, 'Id_Proveedor', row.Id_Proveedor) },
    { key: 'Repuesto', label: 'Repuesto', render: (v, row) => v || getNombre(repuestos, 'Id_Repuesto', row.Id_Repuesto) },
    { key: 'Cantidad', label: 'Cantidad' },
    { key: 'PrecioUnitario', label: 'Precio unitario', render: v => formatCurrency(v) },
    { key: 'total', label: 'Total', render: (_, row) => formatCurrency(Number(row.Cantidad || 0) * Number(row.PrecioUnitario || 0)) },
    { key: 'Fecha', label: 'Fecha', render: v => formatDate(v) },
    // El N.° de factura ya no se muestra en la tabla (puede ser largo y no aporta
    // al vistazo general) -- queda solo en el detalle de la compra.
    {
      key: 'Anulada', label: 'Estado', render: v =>
        v ? <Badge variant="gray">Anulada</Badge> : <Badge variant="success">Vigente</Badge>
    },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" title="Ver detalle" onClick={() => openDetail(row)}>
            <MdVisibility size={17} />
          </button>
          {!row.Anulada && (
            <button className="btn btn--ghost btn--icon btn--sm text-danger hover:bg-danger/8" title="Anular compra" disabled={!puedeAnular} onClick={() => setConfirmAnular(row)}>
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
          <p className="page__subtitle">{total} compra(s) registrada(s)</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Registrar compra</button>
      </div>

      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={onSearch}
            placeholder="Buscar por proveedor, repuesto..."
            filterSlot={
              <FilterDropdown
                statusFilter={statusFilter}
                onStatusChange={onStatus}
                pageSize={pageSize}
                onPageSizeChange={onPageSize}
                statusOptions={[
                  { value: 'todas', label: 'Todas' },
                  { value: 'activas', label: 'Vigentes' },
                  { value: 'anuladas', label: 'Anuladas' },
                ]}
              />
            }
          />
        </div>
        <Table
          columns={columns}
          rowKey="Id_Compra"
          data={rows}
          loading={listLoading}
          serverSide
          total={total}
          page={page}
          onPageChange={setPage}
          pageSize={pageSize}
          searchTerm={search}
          onClearSearch={() => onSearch('')}
          emptyMessage="No se encontraron compras"
        />
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
            <h4 className="mb-md text-body font-bold">Productos ({detailItems.length}){detailLoading ? ' — cargando...' : ''}</h4>
            <div className="overflow-x-auto max-sm:overflow-x-visible">
              <table className={`${TABLA_DETALLE} ${TABLA_DETALLE_MOVIL}`}>
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
                        <td data-label="Repuesto">{row.Repuesto || getNombre(repuestos, 'Id_Repuesto', row.Id_Repuesto)}</td>
                        <td data-label="Cantidad">{row.Cantidad}</td>
                        <td data-label="Precio unitario">{formatCurrency(row.PrecioUnitario)}</td>
                        <td data-label="Subtotal" className="is-total">{formatCurrency(Number(row.Cantidad) * Number(row.PrecioUnitario))}</td>
                        <td data-label="Ganancia">{ganancia != null ? formatCurrency(ganancia) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-lg flex flex-col items-end gap-xs border-t border-border pt-md">
              <div className="flex items-baseline gap-sm">
                <span className="text-small text-text-muted">Total</span>
                <span className="text-h3 font-bold">{formatCurrency(detailTotal)}</span>
              </div>
              <div className="flex items-baseline gap-sm [&>span:first-child]:text-body">
                <span className="text-small text-text-muted">Ganancia estimada</span>
                <span className={`text-body font-semibold ${gananciaTotalDetalle < 0 ? 'text-danger' : 'text-success'}`}>{formatCurrency(gananciaTotalDetalle)}</span>
              </div>
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
        <form className="flex flex-col gap-xl" onSubmit={handleSubmit} noValidate>
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

          <div className="overflow-hidden rounded-md border-[1.5px] border-border">
            <div className={CABECERA_PRODUCTOS}>
              <span>Repuesto</span>
              <span>Cantidad</span>
              <span>Precio unitario</span>
              <span>Descuento %</span>
              <span>Subtotal</span>
              <span></span>
            </div>
            {formData.productos.map((item, idx) => (
              <div key={idx}>
                <div className={FILA_PRODUCTO}>
                  <div className={CAMPO}>
                    <span className={ETIQUETA_CAMPO}>Repuesto</span>
                    <SearchableSelect
                      options={repuestosFiltrados.map(r => ({ value: String(r.Id_Repuesto), label: r.NombreRepuesto ?? r.Nombre }))}
                      value={String(item.Id_Repuesto)}
                      onChange={v => handleItemChange(idx, 'Id_Repuesto', v)}
                      placeholder="Seleccionar repuesto..."
                    />
                  </div>
                  <div className={CAMPO}>
                    <span className={ETIQUETA_CAMPO}>Cantidad</span>
                    <input
                      type="number"
                      min="1"
                      className={CONTROL_SM}
                      value={item.Cantidad}
                      onChange={e => handleItemChange(idx, 'Cantidad', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className={CAMPO}>
                    <span className={ETIQUETA_CAMPO}>Precio unitario</span>
                    <div className="flex flex-col">
                      <input
                        type="number"
                        min="0"
                        className={priceWarnings[idx] ? CONTROL_SM_AVISO : CONTROL_SM}
                        value={item.PrecioUnitario}
                        onChange={e => handleItemChange(idx, 'PrecioUnitario', e.target.value)}
                        placeholder="0"
                      />
                      {item.PrecioUnitario && !priceWarnings[idx] ? <small className={PREVIO_PRECIO}>{formatCurrency(item.PrecioUnitario)}</small> : null}
                    </div>
                  </div>
                  <div className={CAMPO}>
                    <span className={ETIQUETA_CAMPO}>Descuento % <span className="u-hint-sm">(opcional)</span></span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className={CONTROL_SM}
                      value={item.DescuentoPorcentaje}
                      onChange={e => handleItemChange(idx, 'DescuentoPorcentaje', e.target.value)}
                      placeholder="0"
                    />
                    {item.PrecioUnitario && Number(item.DescuentoPorcentaje) > 0 ? (
                      <small className={PREVIO_PRECIO}>
                        Costo neto: {formatCurrency(Number(item.PrecioUnitario) * (1 - Number(item.DescuentoPorcentaje) / 100))}
                      </small>
                    ) : null}
                  </div>
                  <div className={CAMPO}>
                    <span className={ETIQUETA_CAMPO}>Subtotal</span>
                    <span className="whitespace-nowrap pt-[0.45rem] text-body font-semibold text-text max-sm:pt-0">
                      {formatCurrency(Number(item.Cantidad || 0) * Number(item.PrecioUnitario || 0))}
                    </span>
                  </div>
                  <div className={`${CAMPO} max-sm:items-start`}>
                    <button
                      type="button"
                      className="btn btn--ghost btn--icon btn--sm mt-[2px] text-danger hover:not-disabled:bg-danger/8 disabled:opacity-25"
                      disabled={formData.productos.length === 1}
                      onClick={() => removeItem(idx)}
                      title="Eliminar fila"
                    >
                      <MdDeleteOutline size={17} />
                    </button>
                  </div>
                </div>
                {/* text-warning-soft-on (#B45309, 5.02:1) y no text-accent: el ambar
                    puro del CSS anterior media 2.15:1 sobre el blanco del modal, menos
                    de la mitad del minimo AA, y esto es un aviso que hay que poder leer.
                    El borde y el fondo del input si siguen en accent: ahi el color es
                    una senal, no texto. */}
                {priceWarnings[idx] && (
                  <div className="flex items-center gap-[0.375rem] px-md pt-xs pb-sm text-caption text-warning-soft-on">
                    <MdWarning size={14} aria-hidden="true" />
                    El precio de compra registrado para este repuesto es {formatCurrency(priceWarnings[idx].esperado)}.
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-lg">
            <button type="button" className="btn btn--outline btn--sm" onClick={addItem}>
              <MdAdd size={16} /> Agregar producto
            </button>
            <div className="flex items-center gap-[0.625rem]">
              <span className="text-body font-semibold text-text-muted">Total</span>
              <span className="text-[1.0625rem] font-extrabold text-text">{formatCurrency(grandTotal)}</span>
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

