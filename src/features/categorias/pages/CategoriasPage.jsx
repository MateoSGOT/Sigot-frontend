import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdEdit, MdDeleteForever, MdUploadFile } from 'react-icons/md';
import * as XLSX from 'xlsx';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import { useBorradoReal } from '../../../shared/hooks/useBorradoReal.js';
import { categoriasService } from '../services/categoriasService.js';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import EliminarRealModal from '../../../shared/components/EliminarRealModal/EliminarRealModal.jsx';
import { fetchCategorias, createCategoria, updateCategoria, toggleCategoriaEstado } from '../slices/categoriasSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { sortByStatus, sortNewestFirst, filterItems } from '../../../shared/utils/helpers.js';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import './CategoriasPage.css';

const EMPTY = { Nombre: '' };
const RULES = { Nombre: (v) => V.nombre(v, 3, 60) };

export default function CategoriasPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.categorias);
  const puedeCrear   = usePermiso('CATEGORIAS.REGISTRAR');
  const puedeEditar  = usePermiso('CATEGORIAS.EDITAR');
  const puedeToggle  = usePermiso('CATEGORIAS.CAMBIAR_ESTADO');
  const esSuperadmin = useSelector(s => s.auth.empleado?.EsSuperAdmin === true);
  const del = useBorradoReal(categoriasService, {
    entidadLabel: 'categoría',
    onDeleted: () => dispatch(fetchCategorias()),
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize] = useState(5);
  const [formData, setFormData] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const { errors, touched, setErrors, revalidate, markTouched, touchAll, fieldError, isInvalid, validateNow, reset } = useFormValidation(RULES);

  useEffect(() => { dispatch(fetchCategorias()); }, [dispatch]);

  // Importar categorías desde Excel (mismo patrón que Repuestos). Columnas
  // esperadas: "Nombre" (obligatoria) y "Descripcion" (opcional).
  const fileImportRef = useRef(null);
  const [importando, setImportando] = useState(false);
  const [importMsg, setImportMsg] = useState(null); // { ok, fail, faltantes: [] }


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
      let ok = 0, fail = 0; const faltantes = [];
      for (const fila of filas) {
        const nombre = String(fila.Nombre ?? fila.nombre ?? '').trim();
        const descripcion = String(fila.Descripcion ?? fila.descripcion ?? '').trim();
        if (!nombre) { fail++; continue; }
        const r = await dispatch(createCategoria({ Nombre: nombre, Descripcion: descripcion || undefined }));
        if (r.error) { fail++; faltantes.push(nombre); } else ok++;
      }
      setImportMsg({ ok, fail, faltantes: faltantes.slice(0, 8) });
      dispatch(fetchCategorias());
    } catch {
      setImportMsg({ ok: 0, fail: 0, error: 'No se pudo leer el archivo. Verifica que sea un Excel válido.' });
    } finally {
      setImportando(false);
    }
  };

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    list = filterItems(list, search, ['Nombre']);
    return sortByStatus(sortNewestFirst(list, 'Id_categoria'));
  })();

  const openCreate = () => { setFormData(EMPTY); setEditingId(null); setFormError(''); reset(); setShowForm(true); };
  const openEdit = (item) => { setFormData({ Nombre: item.Nombre || '' }); setEditingId(item.Id_categoria); setFormError(''); reset(); setShowForm(true); };
  const handleChange = e => {
    const next = { ...formData, [e.target.name]: e.target.value };
    setFormData(next);
    if (touched[e.target.name] || errors[e.target.name]) revalidate(next);
  };
  const handleBlur = (e) => { markTouched(e.target.name); revalidate(formData); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateNow(formData);
    setErrors(errs); touchAll();
    if (V.hasErrors(errs)) { setFormError('Corrige los campos marcados antes de guardar.'); return; }
    setFormError('');
    const action = editingId ? updateCategoria({ id: editingId, data: formData }) : createCategoria(formData);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); dispatch(fetchCategorias()); }
    else setFormError(result.payload || 'Error al guardar.');
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Nombre', label: 'Nombre', render: v => <span className="font-medium">{v}</span> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleCategoriaEstado({ id: row.Id_categoria, Estado: row.Estado === 1 ? 0 : 1 }))} disabled={!puedeToggle} />
          <button className="btn btn--ghost btn--icon btn--sm" title="Editar" disabled={!puedeEditar} onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          {esSuperadmin && (
            <button className="btn btn--ghost btn--icon btn--sm btn--danger-ghost" title="Eliminar definitivamente" onClick={() => del.open(row.Id_categoria)}><MdDeleteForever size={17} /></button>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Categorías de repuesto</h1><p className="page__subtitle">{items.length} categoría(s) registrada(s)</p></div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input ref={fileImportRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
          <button className="btn btn--outline" onClick={() => fileImportRef.current?.click()} disabled={!puedeCrear || importando} title="Importar categorías desde Excel (columnas: Nombre, Descripcion)"><MdUploadFile size={17} />{importando ? 'Importando...' : 'Importar Excel'}</button>
          <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nueva categoría</button>
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
              : `Importación: ${importMsg.ok} creada(s), ${importMsg.fail} con error.${importMsg.faltantes?.length ? ` No se pudieron: ${importMsg.faltantes.join(', ')}.` : ''}`}</span>
            <button className="btn btn--ghost btn--sm" onClick={() => setImportMsg(null)} style={{ marginLeft: 'auto' }}>Cerrar</button>
          </div>
        );
      })()}
      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre..."
            filterSlot={
              <FilterDropdown
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
              />
            }
          />
        </div>
        <Table columns={columns} rowKey="Id_categoria" data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron categorías" />
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar categoría' : 'Nueva categoría'} size="sm"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading || isInvalid(formData)}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <div className="form-group">
          <label className="form-label">Nombre <span className="required">*</span></label>
          <input name="Nombre" className={`form-control ${fieldError('Nombre') ? 'is-error' : ''}`} value={formData.Nombre} onChange={handleChange} onBlur={handleBlur} maxLength={60} placeholder="Nombre de la categoría" />
          {fieldError('Nombre') && <p className="form-error">{fieldError('Nombre')}</p>}
        </div>
      </Modal>

      <EliminarRealModal
        isOpen={del.isOpen}
        onClose={del.close}
        entidadLabel="categoría"
        preview={del.preview}
        loadingPreview={del.loadingPreview}
        deleting={del.deleting}
        error={del.error}
        onConfirm={del.confirm}
      />
    </div>
  );
}

