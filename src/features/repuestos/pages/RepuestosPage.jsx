import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit, MdWarning, MdTableChart } from 'react-icons/md';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import * as XLSX from 'xlsx';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchRepuestos, createRepuesto, updateRepuesto, toggleRepuestoEstado } from '../slices/repuestosSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { sortByStatus, filterItems, formatCurrency } from '../../../shared/utils/helpers.js';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import api from '../../../shared/services/api.js';
import './RepuestosPage.css';

// El repuesto es una ficha de catálogo: Stock y Costo (Precio) se llenan al comprar, no al crear.
// El margen tiene piso 50% y el precio de venta se calcula (costo × margen × IVA).
const EMPTY = { NombreRepuesto: '', StockMinimo: '5', Id_categoria: '', MargenPorcentaje: '50', _costo: 0, _iva: 19, _precioVenta: null };
const RULES = {
  NombreRepuesto: (v) => V.nombre(v, 3),
  Id_categoria:   (v) => V.requiredSelect(v, 'La categoría'),
  MargenPorcentaje: (v) => {
    if (v == null || String(v).trim() === '') return ''; // opcional; queda en su default 50
    const n = Number(v);
    if (Number.isNaN(n)) return 'El margen debe ser un número.';
    if (n < 50) return 'El margen de ganancia no puede ser menor al 50%.';
    if (n > 1000) return 'El margen no puede superar el 1000%.';
    return '';
  },
};

export default function RepuestosPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.repuestos);
  const puedeCrear   = usePermiso('REPUESTOS.REGISTRAR');
  const puedeEditar  = usePermiso('REPUESTOS.EDITAR');
  const puedeToggle  = usePermiso('REPUESTOS.CAMBIAR_ESTADO');
  const [categorias, setCategorias]       = useState([]);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('todos');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [pageSize, setPageSize]           = useState(5);
  const [stockBajoFilter, setStockBajoFilter] = useState(false);
  const [detailItem, setDetailItem]       = useState(null);
  const [formData, setFormData]           = useState(EMPTY);
  const [editingId, setEditingId]         = useState(null);
  const [showForm, setShowForm]           = useState(false);
  const [formError, setFormError]         = useState('');
  const { errors, touched, setErrors, revalidate, markTouched, touchAll, fieldError, isInvalid, validateNow, reset } = useFormValidation(RULES);

  useEffect(() => {
    dispatch(fetchRepuestos());
    api.get('/api/categoria-repuestos').then(r => setCategorias(r.data?.data || r.data || [])).catch(() => {});
  }, [dispatch]);

  const itemsConStockBajo = items.filter(i => i.Estado !== 0 && Number(i.Stock) <= Number(i.StockMinimo ?? 5));
  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    if (categoriaFilter) list = list.filter(i => String(i.Id_Categoria ?? i.Id_categoria) === categoriaFilter);
    if (stockBajoFilter) list = list.filter(i => i.Estado !== 0 && Number(i.Stock) <= Number(i.StockMinimo ?? 5));
    list = filterItems(list, search, ['Nombre', 'NombreRepuesto']);
    return sortByStatus(list);
  })();

  const exportarExcel = async () => {
    try {
      const res = await api.get('/api/repuestos?limit=9999');
      const data = res.data?.data || res.data || items;
      const catMap = {};
      categorias.forEach(c => { catMap[c.Id_categoria ?? c.Id_Categoria] = c.Nombre; });
      const rows = data.map((r, i) => ({
        '#': i + 1,
        Nombre: r.NombreRepuesto || r.Nombre || '',
        Categoría: catMap[r.Id_categoria ?? r.Id_Categoria] || '—',
        Stock: r.Stock ?? 0,
        Costo: Number(r.Precio ?? 0),
        'Margen %': Number(r.MargenPorcentaje ?? 50),
        'Precio venta': r.PrecioVenta != null ? Number(r.PrecioVenta) : '',
        Estado: r.Estado ? 'Activo' : 'Inactivo',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
      const fecha = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `inventario-repuestos-${fecha}.xlsx`);
    } catch { /* silent */ }
  };

  const openCreate = () => { setFormData(EMPTY); setEditingId(null); setFormError(''); reset(); setShowForm(true); };
  const openEdit = (item) => {
    setFormData({
      NombreRepuesto: item.NombreRepuesto || item.Nombre || '',
      StockMinimo: String(item.StockMinimo ?? 5),
      Id_categoria: String(item.Id_categoria ?? item.Id_Categoria ?? ''),
      MargenPorcentaje: String(item.MargenPorcentaje ?? 50),
      _costo: Number(item.Precio ?? 0),
      _iva: Number(item.IvaPorcentaje ?? 19),
      _precioVenta: item.PrecioVenta ?? null,
    });
    setEditingId(item.Id_Repuesto); setFormError(''); reset(); setShowForm(true);
  };

  // Previsualización del precio de venta al cambiar el margen (la fuente de verdad es la API).
  const previewPrecioVenta = () => {
    const costo = Number(formData._costo ?? 0);
    const iva   = Number(formData._iva ?? 19);
    const m     = Number(formData.MargenPorcentaje);
    if (!costo || Number.isNaN(m) || m < 50) return null;
    return Math.round(costo * (1 + m / 100) * (1 + iva / 100) * 100) / 100;
  };
  const setField = (name, value) => {
    const next = { ...formData, [name]: value };
    setFormData(next);
    if (touched[name] || errors[name]) revalidate(next);
  };
  const handleChange = (e) => setField(e.target.name, e.target.value);
  const handleBlur = (e) => { markTouched(e.target.name); revalidate(formData); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateNow(formData);
    setErrors(errs); touchAll();
    if (V.hasErrors(errs)) { setFormError('Corrige los campos marcados antes de guardar.'); return; }
    setFormError('');
    // Ficha de catálogo: sin Stock ni Costo (la API los deja en 0; se llenan al comprar).
    // El margen sí se puede fijar/ajustar (piso 50%); el precio de venta lo calcula la API.
    const payload = {
      NombreRepuesto: formData.NombreRepuesto.trim(),
      StockMinimo: Number(formData.StockMinimo ?? 5),
      Id_categoria: Number(formData.Id_categoria),
      MargenPorcentaje: Number(formData.MargenPorcentaje || 50),
    };
    const action = editingId ? updateRepuesto({ id: editingId, data: payload }) : createRepuesto(payload);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); dispatch(fetchRepuestos()); }
    else setFormError(result.payload || 'No se pudo guardar el repuesto.');
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Nombre', label: 'Nombre', render: v => <span className="font-medium">{v}</span> },
    { key: 'Categoria', label: 'Categoría' },
    {
      key: 'Stock', label: 'Stock', render: (v, row) => {
        const min = Number(row.StockMinimo ?? 5);
        const stock = Number(v);
        const agotado = stock === 0;
        const bajo = stock <= min;
        return (
          <span className={`stock-cell ${agotado ? 'stock-cell--agotado' : bajo ? 'stock-cell--low' : ''}`}>
            {bajo && <MdWarning size={14} style={{ marginRight: '3px' }} />}
            {v}
            {agotado && <span className="stock-badge stock-badge--agotado">AGOTADO</span>}
            {!agotado && bajo && <span className="stock-badge stock-badge--bajo">STOCK BAJO</span>}
          </span>
        );
      }
    },
    { key: 'StockMinimo', label: 'Stock mín.', render: v => v ?? 5 },
    { key: 'Precio', label: 'Costo', render: v => (v != null && Number(v) > 0 ? formatCurrency(v) : '—') },
    { key: 'MargenPorcentaje', label: 'Margen %', render: v => `${Number(v ?? 50)}%` },
    { key: 'PrecioVenta', label: 'Precio venta', render: v => (v != null ? formatCurrency(v) : '—') },
    { key: 'Estado', label: 'Estado', render: v => <StatusBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setDetailItem(row)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" disabled={!puedeEditar} onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleRepuestoEstado({ id: row.Id_Repuesto, Estado: row.Estado === 1 ? 0 : 1 }))} disabled={!puedeToggle} />
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Repuestos</h1><p className="page__subtitle">{items.length} repuesto(s) en inventario</p></div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn--outline" onClick={exportarExcel} style={{ color: '#16a34a', borderColor: '#16a34a' }}><MdTableChart size={17} />Exportar Excel</button>
          <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nuevo repuesto</button>
        </div>
      </div>
      {itemsConStockBajo.length > 0 && (
        <div className={`stock-alerta-banner ${itemsConStockBajo.some(i => i.Stock === 0) ? 'stock-alerta-banner--critico' : 'stock-alerta-banner--bajo'}`}>
          <MdWarning size={18} />
          <span><strong>{itemsConStockBajo.length}</strong> repuesto(s) necesitan reabastecimiento</span>
          <button
            className="btn btn--sm btn--outline"
            style={{ marginLeft: 'auto' }}
            onClick={() => setStockBajoFilter(v => !v)}
          >
            {stockBajoFilter ? 'Ver todos' : 'Ver solo stock bajo'}
          </button>
        </div>
      )}
      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre..."
            filterSlot={
              <>
                <select className="filter-select" value={categoriaFilter} onChange={e => setCategoriaFilter(e.target.value)}>
                  <option value="">Todas las categorías</option>
                  {categorias.map(c => <option key={c.Id_categoria} value={c.Id_categoria}>{c.Nombre}</option>)}
                </select>
                <FilterDropdown
                  statusFilter={statusFilter}
                  onStatusChange={setStatusFilter}
                  pageSize={pageSize}
                  onPageSizeChange={setPageSize}
                />
              </>
            }
          />
        </div>
        <Table columns={columns} data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron repuestos" />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Detalle del repuesto" size="md">
        {detailItem && <div className="detail-grid">
          <div className="detail-item"><span className="detail-label">Nombre</span><span className="detail-value">{detailItem.Nombre}</span></div>
          <div className="detail-item"><span className="detail-label">Categoría</span><span className="detail-value">{detailItem.Categoria || detailItem.Id_Categoria}</span></div>
          <div className="detail-item"><span className="detail-label">Stock</span><span className="detail-value">{detailItem.Stock}</span></div>
          <div className="detail-item"><span className="detail-label">Costo</span><span className="detail-value">{detailItem.Precio != null && Number(detailItem.Precio) > 0 ? formatCurrency(detailItem.Precio) : '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Margen</span><span className="detail-value">{Number(detailItem.MargenPorcentaje ?? 50)}%</span></div>
          <div className="detail-item"><span className="detail-label">Precio venta {detailItem.IvaPorcentaje != null ? `(IVA ${detailItem.IvaPorcentaje}%)` : ''}</span><span className="detail-value">{detailItem.PrecioVenta != null ? formatCurrency(detailItem.PrecioVenta) : '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><StatusBadge estado={detailItem.Estado} /></span></div>
        </div>}
      </Modal>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar repuesto' : 'Nuevo repuesto'} size="md"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading || isInvalid(formData)}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {formError && <div className="form-error-box">{formError}</div>}
        {!editingId && <p className="form-hint" style={{ marginBottom: '0.5rem' }}>El stock y el precio se registran a través de una compra.</p>}
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="form-group span-2">
            <label className="form-label">Nombre <span className="required">*</span></label>
            <input name="NombreRepuesto" className={`form-control ${fieldError('NombreRepuesto') ? 'is-error' : ''}`} value={formData.NombreRepuesto} onChange={handleChange} onBlur={handleBlur} placeholder="Nombre del repuesto" />
            {fieldError('NombreRepuesto') && <p className="form-error">{fieldError('NombreRepuesto')}</p>}
          </div>
          <div className="form-group span-2">
            <label className="form-label">Categoría <span className="required">*</span></label>
            <select name="Id_categoria" className={`form-control ${fieldError('Id_categoria') ? 'is-error' : ''}`} value={formData.Id_categoria} onChange={handleChange} onBlur={handleBlur}>
              <option value="">Seleccionar categoría...</option>
              {categorias.map(c => <option key={c.Id_categoria} value={c.Id_categoria}>{c.Nombre}</option>)}
            </select>
            {fieldError('Id_categoria') && <p className="form-error">{fieldError('Id_categoria')}</p>}
          </div>
          <div className="form-group span-2">
            <label className="form-label">Stock mínimo</label>
            <input name="StockMinimo" type="number" min="0" className="form-control" value={formData.StockMinimo} onChange={handleChange} placeholder="5" />
          </div>
          <div className="form-group span-2">
            <label className="form-label">Margen de ganancia (%)</label>
            <input name="MargenPorcentaje" type="number" min="50" step="1" className={`form-control ${fieldError('MargenPorcentaje') ? 'is-error' : ''}`} value={formData.MargenPorcentaje} onChange={handleChange} onBlur={handleBlur} placeholder="50" />
            {fieldError('MargenPorcentaje') && <p className="form-error">{fieldError('MargenPorcentaje')}</p>}
            <p className="form-hint">Mínimo 50%. El precio de venta se calcula automáticamente.</p>
          </div>
          {editingId && (
            <>
              <div className="form-group">
                <label className="form-label">Costo (fijado por la compra)</label>
                <input className="form-control" value={Number(formData._costo) > 0 ? formatCurrency(formData._costo) : 'Sin compras aún'} readOnly disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Precio de venta (IVA {formData._iva}%)</label>
                <input className="form-control" value={previewPrecioVenta() != null ? formatCurrency(previewPrecioVenta()) : '—'} readOnly disabled />
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}

