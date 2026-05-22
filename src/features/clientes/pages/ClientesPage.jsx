import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit, MdUploadFile } from 'react-icons/md';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchClientes, createCliente, updateCliente, toggleClienteEstado } from '../slices/clientesSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { sortByStatus, filterItems, formatDate } from '../../../shared/utils/helpers.js';
import api from '../../../shared/services/api.js';
import './ClientesPage.css';

const EMPTY_FORM = { Nombre: '', Id_TipoDoc: '', Documento: '', Telefono: '', Correo: '', Direccion: '', Foto: '' };

export default function ClientesPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading, error } = useSelector((s) => s.clientes);
  const [tiposDoc, setTiposDoc] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize] = useState(5);
  const [detailItem, setDetailItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [fotoPreview, setFotoPreview] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    dispatch(fetchClientes());
    api.get('/api/catalogos/tipos-documento').then(r => setTiposDoc(r.data?.data || r.data || [])).catch(() => {});
  }, [dispatch]);

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    list = filterItems(list, search, ['Nombre', 'Documento', 'Correo', 'Telefono']);
    return sortByStatus(list);
  })();

  const openCreate = () => {
    setFormData(EMPTY_FORM); setEditingId(null); setFormError('');
    setFotoPreview(null); setShowForm(true);
  };

  const openEdit = (item) => {
    setFormData({
      Nombre: item.Nombre || '', Id_TipoDoc: item.Id_TipoDoc || '',
      Documento: item.Documento || '', Telefono: item.Telefono || '',
      Correo: item.Correo || '', Direccion: item.Direccion || '',
      Foto: item.Foto || '',
    });
    setFotoPreview(item.Foto || null);
    setEditingId(item.Id_Cliente); setFormError(''); setShowForm(true);
  };

  const handleFormChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleFotoChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setFotoPreview(ev.target.result);
      setFormData(p => ({ ...p, Foto: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.Nombre || !formData.Documento || !formData.Id_TipoDoc) {
      setFormError('Completa los campos obligatorios.'); return;
    }
    const action = editingId ? updateCliente({ id: editingId, data: formData }) : createCliente(formData);
    const result = await dispatch(action);
    if (!result.error) { setShowForm(false); dispatch(fetchClientes()); }
    else setFormError(result.payload || 'Error al guardar.');
  };

  const handleToggle = (item) => {
    dispatch(toggleClienteEstado({ id: item.Id_Cliente, Estado: item.Estado === 1 ? 0 : 1 }));
  };

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    {
      key: 'Nombre', label: 'Nombre', render: (v, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          {row.Foto
            ? <img src={row.Foto} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(181,242,61,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#b5f23d', flexShrink: 0 }}>{v?.charAt(0)}</div>
          }
          <span className="font-medium">{v}</span>
        </div>
      )
    },
    { key: 'Documento', label: 'Documento' },
    { key: 'Telefono', label: 'TelÃ©fono' },
    { key: 'Correo', label: 'Correo' },
    { key: 'Estado', label: 'Estado', render: (v) => <StatusBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" title="Ver detalle" onClick={() => setDetailItem(row)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" title="Editar" onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          <ToggleSwitch checked={row.Estado === 1} onChange={() => handleToggle(row)} />
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Clientes</h1>
          <p className="page__subtitle">{items.length} cliente(s) registrado(s)</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}><MdAdd size={18} />Nuevo cliente</button>
      </div>

      <div className="card">
        <div className="card__header">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, documento, correo..."
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
        <Table columns={columns} data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron clientes" />
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Detalle del cliente" size="md">
        {detailItem && (
          <div className="detail-grid">
            <div className="detail-item"><span className="detail-label">Nombre</span><span className="detail-value">{detailItem.Nombre}</span></div>
            <div className="detail-item"><span className="detail-label">Tipo de documento</span><span className="detail-value">{detailItem.TipoDoc || detailItem.Id_TipoDoc}</span></div>
            <div className="detail-item"><span className="detail-label">Documento</span><span className="detail-value">{detailItem.Documento}</span></div>
            <div className="detail-item"><span className="detail-label">TelÃ©fono</span><span className="detail-value">{detailItem.Telefono || 'â€”'}</span></div>
            <div className="detail-item"><span className="detail-label">Correo</span><span className="detail-value">{detailItem.Correo || 'â€”'}</span></div>
            <div className="detail-item"><span className="detail-label">DirecciÃ³n</span><span className="detail-value">{detailItem.Direccion || 'â€”'}</span></div>
            <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><StatusBadge estado={detailItem.Estado} /></span></div>
          </div>
        )}
      </Modal>

      {/* Form Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar cliente' : 'Nuevo cliente'} size="md"
        footer={
          <>
            <button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn--primary" onClick={handleFormSubmit} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar'}</button>
          </>
        }
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <form className="form-grid" onSubmit={handleFormSubmit} noValidate>

          {/* Foto de perfil */}
          <div className="form-group span-2">
            <label className="form-label">Foto de perfil</label>
            <div className="file-upload-wrap">
              {fotoPreview && (
                <img src={fotoPreview} alt="preview" className="file-upload-preview" />
              )}
              <div className="file-upload-area" onClick={() => fileRef.current?.click()}>
                <MdUploadFile size={22} style={{ color: 'var(--color-text-muted)' }} />
                <span className="file-upload-label">{fotoPreview ? 'Cambiar foto' : 'Adjuntar foto'}</span>
                <span className="file-upload-hint">JPG, PNG o WebP Â· mÃ¡x. 5 MB</span>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoChange} />
            </div>
          </div>

          <div className="form-group span-2">
            <label className="form-label">Nombre <span className="required">*</span></label>
            <input name="Nombre" className="form-control" value={formData.Nombre} onChange={handleFormChange} placeholder="Nombre completo" />
          </div>

          <div className="form-group">
            <label className="form-label">Tipo de documento <span className="required">*</span></label>
            <select name="Id_TipoDoc" className="form-control" value={formData.Id_TipoDoc} onChange={handleFormChange}>
              <option value="">Seleccionar...</option>
              {tiposDoc.map(t => <option key={t.Id_TipoDoc} value={t.Id_TipoDoc}>{t.Nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">NÃºmero de documento <span className="required">*</span></label>
            <input name="Documento" className="form-control" value={formData.Documento} onChange={handleFormChange} placeholder="NÃºmero de documento" />
          </div>

          <div className="form-group">
            <label className="form-label">TelÃ©fono</label>
            <input name="Telefono" className="form-control" value={formData.Telefono} onChange={handleFormChange} placeholder="TelÃ©fono de contacto" />
          </div>
          <div className="form-group">
            <label className="form-label">Correo electrÃ³nico</label>
            <input name="Correo" type="email" className="form-control" value={formData.Correo} onChange={handleFormChange} placeholder="correo@ejemplo.com" />
          </div>

          <div className="form-group span-2">
            <label className="form-label">DirecciÃ³n</label>
            <input name="Direccion" className="form-control" value={formData.Direccion} onChange={handleFormChange} placeholder="DirecciÃ³n" />
          </div>
        </form>
      </Modal>
    </div>
  );
}

