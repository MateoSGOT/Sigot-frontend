import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit } from 'react-icons/md';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchVehiculos, createVehiculo, updateVehiculo, toggleVehiculoEstado } from '../slices/vehiculosSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { sortByStatus, filterItems } from '../../../shared/utils/helpers.js';
import api from '../../../shared/services/api.js';
import './VehiculosPage.css';

const MARCAS_MODELOS = {
  'Mercedes': ['Clase A', 'Clase C', 'Clase E', 'Clase S', 'GLC', 'GLE', 'GLS'],
  'Mazda': ['Mazda 2', 'Mazda 3', 'Mazda 6', 'CX-5', 'CX-30', 'MX-5', 'CX-9'],
  'Toyota': ['Corolla', 'Camry', 'Hilux', 'RAV4', 'Prado', 'Yaris', 'Fortuner', 'Rush'],
  'Ford': ['Focus', 'Fiesta', 'Explorer', 'F-150', 'Mustang', 'EcoSport', 'Escape'],
  'Chevrolet': ['Spark', 'Sail', 'Onix', 'Tracker', 'Trailblazer', 'Colorado', 'Equinox'],
  'BMW': ['Serie 1', 'Serie 3', 'Serie 5', 'Serie 7', 'X1', 'X3', 'X5', 'Z4'],
  'Audi': ['A3', 'A4', 'A6', 'A8', 'Q3', 'Q5', 'Q7', 'TT'],
  'Kia': ['Picanto', 'Rio', 'Cerato', 'Sportage', 'Sorento', 'Stinger', 'Carnival'],
  'Hyundai': ['i10', 'i20', 'Accent', 'Elantra', 'Tucson', 'Santa Fe', 'Kona', 'Ioniq'],
  'Renault': ['Twingo', 'Clio', 'Sandero', 'Duster', 'Koleos', 'Logan', 'Stepway'],
  'Volkswagen': ['Polo', 'Golf', 'Jetta', 'Passat', 'Tiguan', 'Touareg', 'T-Cross'],
  'Nissan': ['March', 'Tiida', 'Sentra', 'X-Trail', 'Frontier', 'Kicks', 'Navara'],
  'Honda': ['Fit', 'City', 'Civic', 'Accord', 'CR-V', 'HR-V', 'Pilot'],
  'Suzuki': ['Alto', 'Celerio', 'Swift', 'Vitara', 'S-Cross', 'Jimny', 'Ertiga'],
};

const EMPTY = { Placa: '', VIN: '', Id_Marca: '', Modelo: '', Anio: '', Color: '', Id_Cliente: '' };

export default function VehiculosPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.vehiculos);
  const puedeCrear   = usePermiso('VEHICULOS.REGISTRAR');
  const puedeEditar  = usePermiso('VEHICULOS.EDITAR');
  const puedeToggle  = usePermiso('VEHICULOS.CAMBIAR_ESTADO');
  const [marcas, setMarcas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [marcaFilter, setMarcaFilter] = useState('');
  const [pageSize, setPageSize] = useState(5);
  const [detailItem, setDetailItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    dispatch(fetchVehiculos());
    api.get('/api/catalogos/marcas').then(r => setMarcas(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/clientes').then(r => setClientes(r.data?.data || r.data || [])).catch(() => {});
  }, [dispatch]);

  const selectedMarcaNombre = marcas.find(m => String(m.Id_Marca) === String(formData.Id_Marca))?.Nombre || '';
  const modeloOptions = MARCAS_MODELOS[selectedMarcaNombre] || [];

  const marcasOpts   = marcas.map(m => ({ value: String(m.Id_Marca), label: m.Nombre }));
  const clientesOpts = clientes.map(c => ({ value: String(c.Id_Cliente), label: `${c.Nombre} — ${c.Documento}` }));

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    if (marcaFilter) list = list.filter(i => String(i.Id_Marca) === marcaFilter || (i.Marca && i.Marca.toLowerCase() === marcas.find(m => String(m.Id_Marca) === marcaFilter)?.Nombre?.toLowerCase()));
    list = filterItems(list, search, ['Placa', 'VIN', 'Modelo', 'Color']);
    return sortByStatus(list);
  })();

  const openCreate = () => {
    setFormData(EMPTY); setEditingId(null); setFormError(''); setShowForm(true);
  };

  const openEdit = (item) => {
    setFormData({ Placa: item.Placa || '', VIN: item.VIN || '', Id_Marca: item.Id_Marca || '', Modelo: item.Modelo || '', Anio: item.Anio || '', Color: item.Color || '', Id_Cliente: item.Id_Cliente || '' });
    setEditingId(item.Id_Vehiculo); setFormError(''); setShowForm(true);
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(p => {
      const next = { ...p, [name]: value };
      if (name === 'Id_Marca') next.Modelo = '';
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.Placa || !formData.Id_Marca || !formData.Modelo || !formData.Anio || !formData.Id_Cliente) {
      setFormError('Completa los campos obligatorios.'); return;
    }
    const action = editingId ? updateVehiculo({ id: editingId, data: formData }) : createVehiculo(formData);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); dispatch(fetchVehiculos()); }
    else setFormError(result.payload || 'Error al guardar.');
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    { key: 'Placa', label: 'Placa', render: v => <span className="font-medium">{v}</span> },
    { key: 'VIN', label: 'VIN' },
    { key: 'Marca', label: 'Marca' },
    { key: 'Modelo', label: 'Modelo' },
    { key: 'Anio', label: 'Año' },
    { key: 'Color', label: 'Color' },
    { key: 'Cliente', label: 'Cliente' },
    { key: 'Estado', label: 'Estado', render: v => <StatusBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setDetailItem(row)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" disabled={!puedeEditar} onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleVehiculoEstado({ id: row.Id_Vehiculo, Estado: row.Estado === 1 ? 0 : 1 }))} disabled={!puedeToggle} />
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div><h1 className="page__title">Vehículos</h1><p className="page__subtitle">{items.length} vehículo(s) registrado(s)</p></div>
        <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nuevo vehículo</button>
      </div>
      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por placa, VIN, modelo..."
            filterSlot={
              <>
                <select className="filter-select" value={marcaFilter} onChange={e => setMarcaFilter(e.target.value)}>
                  <option value="">Todas las marcas</option>
                  {marcas.map(m => <option key={m.Id_Marca} value={m.Id_Marca}>{m.Nombre}</option>)}
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
        <Table columns={columns} data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron vehículos" />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Detalle del vehículo" size="md">
        {detailItem && <div className="detail-grid">
          <div className="detail-item"><span className="detail-label">Placa</span><span className="detail-value">{detailItem.Placa}</span></div>
          <div className="detail-item"><span className="detail-label">VIN</span><span className="detail-value">{detailItem.VIN || '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Marca</span><span className="detail-value">{detailItem.Marca || detailItem.Id_Marca}</span></div>
          <div className="detail-item"><span className="detail-label">Modelo</span><span className="detail-value">{detailItem.Modelo}</span></div>
          <div className="detail-item"><span className="detail-label">Año</span><span className="detail-value">{detailItem.Anio}</span></div>
          <div className="detail-item"><span className="detail-label">Color</span><span className="detail-value">{detailItem.Color || '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Cliente</span><span className="detail-value">{detailItem.Cliente || detailItem.Id_Cliente}</span></div>
          <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><StatusBadge estado={detailItem.Estado} /></span></div>
        </div>}
      </Modal>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar vehículo' : 'Nuevo vehículo'} size="md"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Placa <span className="required">*</span></label>
            <input name="Placa" className="form-control" value={formData.Placa} onChange={handleChange} placeholder="ABC-123" />
          </div>
          <div className="form-group">
            <label className="form-label">VIN</label>
            <input name="VIN" className="form-control" value={formData.VIN} onChange={handleChange} placeholder="Número VIN" />
          </div>
          <div className="form-group">
            <label className="form-label">Marca <span className="required">*</span></label>
            <SearchableSelect
              options={marcasOpts}
              value={String(formData.Id_Marca)}
              onChange={v => setFormData(p => ({ ...p, Id_Marca: v, Modelo: '' }))}
              placeholder="Seleccionar marca..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">Modelo <span className="required">*</span></label>
            {modeloOptions.length > 0 ? (
              <select name="Modelo" className="form-control" value={formData.Modelo} onChange={handleChange}>
                <option value="">Seleccionar modelo...</option>
                {modeloOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input name="Modelo" className="form-control" value={formData.Modelo} onChange={handleChange} placeholder="Ej: Corolla" />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Año <span className="required">*</span></label>
            <input name="Anio" type="number" className="form-control" value={formData.Anio} onChange={handleChange} placeholder="2023" min="1900" max="2100" />
          </div>
          <div className="form-group">
            <label className="form-label">Color</label>
            <input name="Color" className="form-control" value={formData.Color} onChange={handleChange} placeholder="Blanco" />
          </div>
          <div className="form-group span-2">
            <label className="form-label">Cliente <span className="required">*</span></label>
            <SearchableSelect
              options={clientesOpts}
              value={String(formData.Id_Cliente)}
              onChange={v => setFormData(p => ({ ...p, Id_Cliente: v }))}
              placeholder="Buscar cliente por nombre o documento..."
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

