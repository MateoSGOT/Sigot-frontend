import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit } from 'react-icons/md';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import { fetchNovedades, createNovedad, updateNovedad } from '../slices/novedadesSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { filterItems, formatDate } from '../../../shared/utils/helpers.js';
import api from '../../../shared/services/api.js';
import './NovedadesPage.css';

const EMPTY = { id_empleado: '', Descripcion: '', Fecha_Novedad: '', FechaRealizacion: '' };
const TODAY = new Date().toISOString().split('T')[0];

export default function NovedadesPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.novedades);
  const puedeCrear   = usePermiso('NOVEDADES.REGISTRAR');
  const puedeEditar  = usePermiso('NOVEDADES.EDITAR');
  const [empleados, setEmpleados] = useState([]);
  const [search, setSearch]       = useState('');
  const [pageSize, setPageSize]   = useState(5);
  const [detailItem, setDetailItem] = useState(null);
  const [formData, setFormData]   = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    dispatch(fetchNovedades());
    api.get('/api/empleados').then(r => setEmpleados(r.data?.data || r.data || [])).catch(() => {});
  }, [dispatch]);

  const getEmpleadoNombre = (id) => {
    const e = empleados.find(e => e.Id_Empleado === id);
    return e?.Nombre || `Empleado #${id}`;
  };

  const filtered = filterItems(items, search, ['Descripcion']);

  const openCreate = () => { setFormData(EMPTY); setEditingId(null); setFormError(''); setShowForm(true); };
  const openEdit   = (item) => {
    setFormData({
      id_empleado:     item.id_empleado || item.Id_Empleado || '',
      Descripcion:     item.Descripcion || '',
      Fecha_Novedad:   item.Fecha_Novedad   ? item.Fecha_Novedad.split('T')[0]   : '',
      FechaRealizacion: item.FechaRealizacion ? item.FechaRealizacion.split('T')[0] : '',
    });
    setEditingId(item.Id_Novedad || item.id); setFormError(''); setShowForm(true);
  };
  const handleChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.id_empleado || !formData.Descripcion || !formData.Fecha_Novedad || !formData.FechaRealizacion) {
      setFormError('Completa los campos obligatorios.'); return;
    }
    const payload = {
      ...formData,
      id_empleado:     Number(formData.id_empleado),
      Fecha_Novedad:   new Date(formData.Fecha_Novedad).toISOString(),
      FechaRealizacion: new Date(formData.FechaRealizacion).toISOString(),
    };
    const action = editingId ? updateNovedad({ id: editingId, data: payload }) : createNovedad(payload);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); dispatch(fetchNovedades()); }
    else setFormError(result.payload || 'Error al guardar.');
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'id_empleado', label: 'Empleado', render: (v, row) => getEmpleadoNombre(v || row.Id_Empleado) },
    { key: 'Descripcion', label: 'Descripción', render: v => <span className="descripcion-cell">{v}</span> },
    { key: 'Fecha_Novedad',    label: 'Fecha novedad',    render: v => formatDate(v) },
    { key: 'FechaRealizacion', label: 'Fecha realización', render: v => formatDate(v) },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setDetailItem(row)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" disabled={!puedeEditar} onClick={() => openEdit(row)}><MdEdit size={17} /></button>
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Novedades</h1><p className="page__subtitle">{items.length} novedad(es) registrada(s)</p></div>
        <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nueva novedad</button>
      </div>
      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por descripción..."
            filterSlot={
              <FilterDropdown
                statusFilter="todos"
                onStatusChange={() => {}}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
              />
            }
          />
        </div>
        <Table columns={columns} data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron novedades" />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Detalle de la novedad" size="md">
        {detailItem && <div className="detail-grid">
          <div className="detail-item"><span className="detail-label">Empleado</span><span className="detail-value">{getEmpleadoNombre(detailItem.id_empleado || detailItem.Id_Empleado)}</span></div>
          <div className="detail-item"><span className="detail-label">Fecha novedad</span><span className="detail-value">{formatDate(detailItem.Fecha_Novedad)}</span></div>
          <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Descripción</span><span className="detail-value">{detailItem.Descripcion}</span></div>
          <div className="detail-item"><span className="detail-label">Fecha realización</span><span className="detail-value">{formatDate(detailItem.FechaRealizacion)}</span></div>
        </div>}
      </Modal>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar novedad' : 'Nueva novedad'} size="md"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="form-group span-2">
            <label className="form-label">Empleado <span className="required">*</span></label>
            <SearchableSelect
              options={empleados.map(e => ({ value: String(e.Id_Empleado), label: e.Nombre }))}
              value={String(formData.id_empleado)}
              onChange={v => setFormData(p => ({ ...p, id_empleado: v }))}
              placeholder="Seleccionar empleado..."
            />
          </div>
          <div className="form-group span-2">
            <label className="form-label">Descripción <span className="required">*</span></label>
            <textarea name="Descripcion" className="form-control" value={formData.Descripcion} onChange={handleChange} rows={3} placeholder="Describe la novedad..." />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha de la novedad <span className="required">*</span></label>
            <input name="Fecha_Novedad" type="date" className="form-control" value={formData.Fecha_Novedad} onChange={handleChange} min={TODAY} />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha de realización <span className="required">*</span></label>
            <input name="FechaRealizacion" type="date" className="form-control" value={formData.FechaRealizacion} onChange={handleChange} min={TODAY} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

