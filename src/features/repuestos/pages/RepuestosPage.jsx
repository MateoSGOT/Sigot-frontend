import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit, MdWarning, MdTableChart, MdDeleteForever, MdUploadFile } from 'react-icons/md';
import { useBorradoReal } from '../../../shared/hooks/useBorradoReal.js';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh.js';
import { repuestosService } from '../services/repuestosService.js';
import EliminarRealModal from '../../../shared/components/EliminarRealModal/EliminarRealModal.jsx';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import * as XLSX from 'xlsx';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { createRepuesto, updateRepuesto, toggleRepuestoEstado } from '../slices/repuestosSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { formatCurrency, todayLocalYMD } from '../../../shared/utils/helpers.js';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import api from '../../../shared/services/api.js';
import './RepuestosPage.css';

// El repuesto es una ficha de catálogo: Stock y Costo (Precio) se llenan al comprar, no al crear.
// El margen tiene piso 50% y el precio de venta se calcula (costo × margen × IVA).
const EMPTY = { NombreRepuesto: '', StockMinimo: '5', Id_categoria: '', MargenPorcentaje: '50', _costo: 0, _iva: 19, _precioVenta: null };
const RULES = {
  NombreRepuesto: (v) => V.nombre(v, 3, 120),
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
  const { actionLoading } = useSelector(s => s.repuestos);
  const puedeCrear   = usePermiso('REPUESTOS.REGISTRAR');
  const puedeEditar  = usePermiso('REPUESTOS.EDITAR');
  const puedeToggle  = usePermiso('REPUESTOS.CAMBIAR_ESTADO');
  const [categorias, setCategorias]       = useState([]);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('todos');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [pageSize, setPageSize]           = useState(5);
  const [stockBajoFilter, setStockBajoFilter] = useState(false);
  // Estado del listado SERVER-SIDE (piloto de paginación).
  const [page, setPage]         = useState(1);
  const [rows, setRows]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [stockBajoItems, setStockBajoItems] = useState([]); // para el banner (todo, no paginado)
  const [detailItem, setDetailItem]       = useState(null);
  const [formData, setFormData]           = useState(EMPTY);
  const [editingId, setEditingId]         = useState(null);
  const [showForm, setShowForm]           = useState(false);
  const [formError, setFormError]         = useState('');
  const { errors, touched, setErrors, revalidate, markTouched, touchAll, fieldError, isInvalid, validateNow, reset } = useFormValidation(RULES);

  const pageSizeNum = pageSize === 'all' ? (total || 9999) : Number(pageSize);

  // Pide al backend la página actual con los filtros vigentes (server-side).
  const fetchPage = useCallback(async () => {
    setListLoading(true);
    try {
      const ps = pageSize === 'all' ? 9999 : pageSize;
      const params = new URLSearchParams({ page: String(page), pageSize: String(ps), estado: statusFilter });
      if (search) params.set('search', search);
      if (categoriaFilter) params.set('categoria', categoriaFilter);
      if (stockBajoFilter) params.set('soloBajo', 'true');
      const r = await api.get(`/api/repuestos?${params.toString()}`);
      // El backend devuelve NombreRepuesto; la columna de la tabla lee `Nombre`
      // (igual que exportarExcel y openEdit). Sin este mapeo el nombre sale en blanco.
      setRows((r.data?.data || []).map(x => ({ ...x, Nombre: x.NombreRepuesto || x.Nombre || '' })));
      setTotal(r.data?.total ?? 0);
    } catch { setRows([]); setTotal(0); }
    finally { setListLoading(false); }
  }, [page, pageSize, search, statusFilter, categoriaFilter, stockBajoFilter]);

  const fetchStockBajo = useCallback(async () => {
    try { const r = await api.get('/api/repuestos/stock-bajo'); setStockBajoItems(r.data?.data || r.data || []); } catch { /* silent */ }
  }, []);

  const esSuperadmin = useSelector(s => s.auth.empleado?.EsSuperAdmin === true);
  const del = useBorradoReal(repuestosService, { entidadLabel: 'repuesto', onDeleted: () => { fetchPage(); fetchStockBajo(); } });

  useEffect(() => {
    api.get('/api/categoria-repuestos').then(r => setCategorias(r.data?.data || r.data || [])).catch(() => {});
    fetchStockBajo();
  }, [fetchStockBajo]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  // Al cambiar búsqueda/filtro → reiniciar a la página 1 (y refetch por dependencias).
  const onSearch    = (v) => { setSearch(v); setPage(1); };
  const onCategoria = (v) => { setCategoriaFilter(v); setPage(1); };
  const onStatus    = (v) => { setStatusFilter(v); setPage(1); };
  const onPageSize  = (v) => { setPageSize(v); setPage(1); };
  const onToggleBajo = () => { setStockBajoFilter(v => !v); setPage(1); };
  const refrescar = () => { fetchPage(); fetchStockBajo(); };

  const itemsConStockBajo = stockBajoItems;

  const exportarExcel = async () => {
    try {
      const res = await api.get('/api/repuestos?limit=9999');
      const data = res.data?.data || res.data || rows;
      const catMap = {};
      categorias.forEach(c => { catMap[c.Id_categoria ?? c.Id_Categoria] = c.Nombre; });
      const exportRows = data.map((r, i) => ({
        '#': i + 1,
        Nombre: r.NombreRepuesto || r.Nombre || '',
        Categoría: catMap[r.Id_categoria ?? r.Id_Categoria] || '—',
        Stock: r.Stock ?? 0,
        Costo: Number(r.Precio ?? 0),
        'Margen %': Number(r.MargenPorcentaje ?? 50),
        'Precio venta': r.PrecioVenta != null ? Number(r.PrecioVenta) : '',
        Estado: r.Estado ? 'Activo' : 'Inactivo',
      }));
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
      const fecha = todayLocalYMD();
      XLSX.writeFile(wb, `inventario-repuestos-${fecha}.xlsx`);
    } catch { /* silent */ }
  };

  // Importar repuestos desde Excel (item 6). Formato: columnas "Nombre" y
  // "Categoría" (por nombre); opcional "Margen %" y "Stock mínimo". La categoría
  // debe existir ya (se mapea por nombre).
  const fileImportRef = useRef(null);
  const [importando, setImportando] = useState(false);
  const [importMsg, setImportMsg] = useState(null); // { ok, fail, faltantes: [] }

  useAutoRefresh(() => { fetchPage(); fetchStockBajo(); }, { intervalMs: 20000, enabled: !showForm && !del.isOpen && !importando });

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reimportar el mismo archivo
    if (!file) return;
    setImportando(true);
    setImportMsg(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const catByName = {};
      categorias.forEach(c => { const n = String(c.Nombre ?? c.nombre ?? '').trim().toLowerCase(); if (n) catByName[n] = c.Id_categoria ?? c.Id_Categoria; });
      let ok = 0, fail = 0; const faltantes = [];
      for (const fila of filas) {
        const nombre    = String(fila.Nombre ?? fila.NombreRepuesto ?? fila.nombre ?? '').trim();
        const catNombre = String(fila['Categoría'] ?? fila.Categoria ?? fila.categoria ?? '').trim().toLowerCase();
        const idCat = catByName[catNombre];
        if (!nombre || !idCat) { fail++; if (nombre) faltantes.push(nombre); continue; }
        const r = await dispatch(createRepuesto({
          NombreRepuesto: nombre,
          Id_categoria: idCat,
          StockMinimo: Number(fila['Stock mínimo'] ?? fila.StockMinimo ?? 5) || 5,
          MargenPorcentaje: Number(fila['Margen %'] ?? fila.MargenPorcentaje ?? 50) || 50,
        }));
        if (r.error) { fail++; faltantes.push(nombre); } else ok++;
      }
      setImportMsg({ ok, fail, faltantes: faltantes.slice(0, 8) });
      fetchPage();
    } catch {
      setImportMsg({ ok: 0, fail: 0, error: 'No se pudo leer el archivo. Verifica que sea un Excel válido.' });
    } finally {
      setImportando(false);
    }
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
    if (!result.error) { setShowForm(false); refrescar(); }
    else setFormError(result.payload || 'No se pudo guardar el repuesto.');
  };

  const handleToggle = async (row) => {
    const r = await dispatch(toggleRepuestoEstado({ id: row.Id_Repuesto, Estado: row.Estado === 1 ? 0 : 1 }));
    if (!r.error) refrescar();
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => (page - 1) * pageSizeNum + i + 1 },
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
          <ToggleSwitch checked={row.Estado === 1} onChange={() => handleToggle(row)} disabled={!puedeToggle} />
          <button className="btn btn--ghost btn--icon btn--sm" title="Ver" onClick={() => setDetailItem(row)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" title="Editar" disabled={!puedeEditar} onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          {esSuperadmin && (
            <button className="btn btn--ghost btn--icon btn--sm btn--danger-ghost" title="Eliminar definitivamente" onClick={() => del.open(row.Id_Repuesto)}><MdDeleteForever size={17} /></button>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Repuestos</h1><p className="page__subtitle">{total} repuesto(s) en inventario</p></div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input ref={fileImportRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
          <button className="btn btn--outline" onClick={() => fileImportRef.current?.click()} disabled={!puedeCrear || importando} title="Importar repuestos desde Excel (columnas: Nombre, Categoría)"><MdUploadFile size={17} />{importando ? 'Importando...' : 'Importar Excel'}</button>
          <button className="btn btn--outline" onClick={exportarExcel} style={{ color: '#16a34a', borderColor: '#16a34a' }}><MdTableChart size={17} />Exportar Excel</button>
          <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nuevo repuesto</button>
        </div>
      </div>
      {importMsg && (() => {
        const hayError = !!importMsg.error || importMsg.fail > 0;
        return (
          <div style={{
            margin: '0 2rem 1rem', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.875rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
            background: hayError ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.10)',
            border: `1px solid ${hayError ? 'rgba(220,38,38,0.3)' : 'rgba(22,163,74,0.3)'}`,
            color: hayError ? '#b91c1c' : '#136a32',
          }}>
            <span>{importMsg.error
              ? importMsg.error
              : `Importación: ${importMsg.ok} creado(s), ${importMsg.fail} con error.${importMsg.faltantes?.length ? ` No se pudieron: ${importMsg.faltantes.join(', ')} (revisa que la categoría exista).` : ''}`}</span>
            <button className="btn btn--ghost btn--sm" onClick={() => setImportMsg(null)} style={{ marginLeft: 'auto' }}>Cerrar</button>
          </div>
        );
      })()}
      {itemsConStockBajo.length > 0 && (
        <div className={`stock-alerta-banner ${itemsConStockBajo.some(i => i.Stock === 0) ? 'stock-alerta-banner--critico' : 'stock-alerta-banner--bajo'}`}>
          <MdWarning size={18} />
          <span><strong>{itemsConStockBajo.length}</strong> repuesto(s) necesitan reabastecimiento</span>
          <button
            className="btn btn--sm btn--outline"
            style={{ marginLeft: 'auto' }}
            onClick={onToggleBajo}
          >
            {stockBajoFilter ? 'Ver todos' : 'Ver solo stock bajo'}
          </button>
        </div>
      )}
      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={onSearch}
            placeholder="Buscar por nombre..."
            filterSlot={
              <>
                <select className="filter-select" value={categoriaFilter} onChange={e => onCategoria(e.target.value)}>
                  <option value="">Todas las categorías</option>
                  {categorias.map(c => <option key={c.Id_categoria} value={c.Id_categoria}>{c.Nombre}</option>)}
                </select>
                <FilterDropdown
                  statusFilter={statusFilter}
                  onStatusChange={onStatus}
                  pageSize={pageSize}
                  onPageSizeChange={onPageSize}
                />
              </>
            }
          />
        </div>
        <Table
          columns={columns}
          rowKey="Id_Repuesto"
          data={rows}
          loading={listLoading}
          serverSide
          total={total}
          page={page}
          onPageChange={setPage}
          pageSize={pageSize}
          searchTerm={search}
          onClearSearch={() => onSearch('')}
          emptyMessage="No se encontraron repuestos"
        />
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
            <input name="NombreRepuesto" className={`form-control ${fieldError('NombreRepuesto') ? 'is-error' : ''}`} value={formData.NombreRepuesto} onChange={handleChange} onBlur={handleBlur} maxLength={120} placeholder="Nombre del repuesto" />
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

      <EliminarRealModal isOpen={del.isOpen} onClose={del.close} entidadLabel="repuesto"
        preview={del.preview} loadingPreview={del.loadingPreview} deleting={del.deleting} error={del.error} onConfirm={del.confirm} />
    </div>
  );
}

