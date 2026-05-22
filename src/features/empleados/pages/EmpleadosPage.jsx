import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit, MdWarning, MdVisibilityOff } from 'react-icons/md';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { fetchEmpleados, createEmpleado, updateEmpleado, toggleEmpleadoEstado } from '../slices/empleadosSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import Badge from '../../../shared/components/Badge/Badge.jsx';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import ImageUploader from '../../../shared/components/ImageUploader/ImageUploader.jsx';
import { sortByStatus, filterItems, formatDate } from '../../../shared/utils/helpers.js';
import api from '../../../shared/services/api.js';
import './EmpleadosPage.css';

const EMPTY = { Nombre: '', Id_TipoDoc: '', Documento: '', Id_Rol: '', Correo: '', Password: '' };

export default function EmpleadosPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.empleados);
  const [tiposDoc, setTiposDoc] = useState([]);
  const [roles, setRoles] = useState([]);
  const [novedades, setNovedades] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize] = useState(5);
  const [detailItem, setDetailItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    dispatch(fetchEmpleados());
    api.get('/api/catalogos/tipos-documento').then(r => setTiposDoc(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/roles').then(r => setRoles(r.data?.data || r.data || [])).catch(() => {});
    api.get('/api/novedades').then(r => setNovedades(r.data?.data || r.data || [])).catch(() => {});
  }, [dispatch]);

  const getEmpNovedades = (id) => novedades.filter(n => n.id_empleado === id || n.Id_Empleado === id);

  const filtered = (() => {
    let list = items;
    if (statusFilter === 'activos') list = list.filter(i => i.Estado !== 0);
    else if (statusFilter === 'inactivos') list = list.filter(i => i.Estado === 0);
    list = filterItems(list, search, ['Nombre', 'Documento', 'Correo']);
    return sortByStatus(list);
  })();

  const openCreate = () => {
    setFormData(EMPTY); setEditingId(null); setFormError('');
    setShowPassword(false); setFotoPreview(null); setPhotoFile(null); setSavedOk(false); setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.Id_Empleado); setFormError(''); setSavedOk(false); setShowPassword(false);
    setFotoPreview(item.Foto_url || item.Foto || null);
    setPhotoFile(null);
    setFormData({
      Nombre: item.Nombre || '', Id_TipoDoc: item.Id_TipoDoc || '',
      Documento: item.Documento || '', Id_Rol: item.Id_Rol || '',
      Correo: item.Correo || '', Password: '',
    });
    setShowForm(true);
  };

  const handleChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handlePhotoChange = (file) => {
    setPhotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.Nombre || !formData.Documento || !formData.Id_TipoDoc || !formData.Id_Rol || !formData.Correo) {
      setFormError('Completa los campos obligatorios.'); return;
    }
    if (!editingId && !formData.Password) {
      setFormError('La contraseña es obligatoria para nuevos empleados.'); return;
    }

    const fd = new FormData();
    fd.append('Nombre', formData.Nombre);
    fd.append('Documento', formData.Documento);
    fd.append('Id_TipoDoc', formData.Id_TipoDoc);
    fd.append('Id_Rol', formData.Id_Rol);
    fd.append('Correo', formData.Correo);
    if (formData.Password) fd.append('Password', formData.Password);
    if (photoFile) fd.append('foto', photoFile);

    const action = editingId ? updateEmpleado({ id: editingId, data: fd }) : createEmpleado(fd);
    const result = await dispatch(action);
    if (!result.error) {
      setShowForm(false); setSavedOk(true); dispatch(fetchEmpleados());
      setTimeout(() => setSavedOk(false), 3000);
    } else { setFormError(result.payload || 'Error al guardar.'); }
  };

  const tiposDocOpts = tiposDoc.map(t => ({ value: String(t.Id_TipoDoc), label: t.Nombre }));
  const rolesOpts    = roles.map(r => ({ value: String(r.Id_Rol), label: r.Nombre }));

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    {
      key: 'Nombre', label: 'Nombre', render: (v, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          {(row.Foto_url || row.Foto)
            ? <img src={row.Foto_url || row.Foto} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(181,242,61,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#b5f23d', flexShrink: 0 }}>{v?.charAt(0)}</div>
          }
          <span className="font-medium">{v}</span>
        </div>
      )
    },
    { key: 'Documento', label: 'Documento' },
    { key: 'Rol', label: 'Rol' },
    { key: 'Correo', label: 'Correo' },
    {
      key: 'novedades', label: 'Novedades', render: (_, row) => {
        const novs = getEmpNovedades(row.Id_Empleado);
        return novs.length > 0
          ? <Badge variant="warning"><MdWarning size={12} style={{ marginRight: '3px' }} />{novs.length} novedad(es)</Badge>
          : <span className="text-muted" style={{ fontSize: '0.8rem' }}>Sin novedades</span>;
      }
    },
    { key: 'Estado', label: 'Estado', render: v => <StatusBadge estado={v} /> },
    {
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setDetailItem(row)}><MdVisibility size={17} /></button>
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => openEdit(row)}><MdEdit size={17} /></button>
          {row.Id_Rol !== 1 && (
            <ToggleSwitch checked={row.Estado === 1} onChange={() => dispatch(toggleEmpleadoEstado({ id: row.Id_Empleado, Estado: row.Estado === 1 ? 0 : 1 }))} />
          )}
        </div>
      )
    },
  ];

  const detailNovedades = detailItem ? getEmpNovedades(detailItem.Id_Empleado) : [];

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Empleados</h1>
          <p className="page__subtitle">{items.length} empleado(s) registrado(s)</p>
        </div>
        <button className="btn btn--primary" onClick={openCreate}><MdAdd size={18} />Nuevo empleado</button>
      </div>

      {savedOk && (
        <div style={{ margin: '0.75rem 2rem 0', padding: '0.75rem 1rem', background: 'rgba(181,242,61,0.12)', border: '1px solid rgba(181,242,61,0.3)', borderRadius: '8px', color: '#b5f23d', fontSize: '0.875rem' }}>
          ✓ Empleado guardado correctamente.
        </div>
      )}

      <div className="card">
        <div className="card__header">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, documento, correo..."
            filterSlot={<FilterDropdown statusFilter={statusFilter} onStatusChange={setStatusFilter} pageSize={pageSize} onPageSizeChange={setPageSize} />}
          />
        </div>
        <Table columns={columns} data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron empleados" />
      </div>

      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Detalle del empleado" size="lg">
        {detailItem && (
          <div>
            <div className="detail-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="detail-item"><span className="detail-label">Nombre</span><span className="detail-value">{detailItem.Nombre}</span></div>
              <div className="detail-item"><span className="detail-label">Documento</span><span className="detail-value">{detailItem.Documento}</span></div>
              <div className="detail-item"><span className="detail-label">Tipo documento</span><span className="detail-value">{detailItem.TipoDocumento || detailItem.Id_TipoDoc}</span></div>
              <div className="detail-item"><span className="detail-label">Rol</span><span className="detail-value">{detailItem.Rol || detailItem.Id_Rol}</span></div>
              <div className="detail-item"><span className="detail-label">Correo</span><span className="detail-value">{detailItem.Correo}</span></div>
              <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value"><StatusBadge estado={detailItem.Estado} /></span></div>
            </div>
            {detailNovedades.length > 0 && (
              <div>
                <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: '700' }}>Novedades registradas</h4>
                <div className="novedades-list">
                  {detailNovedades.map((n, i) => (
                    <div key={i} className="novedad-item">
                      <MdWarning size={16} style={{ color: '#f5a623', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: '600' }}>{n.Descripcion}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{formatDate(n.Fecha_Novedad)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar empleado' : 'Nuevo empleado'} size="lg"
        footer={<><button className="btn btn--outline" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn--primary" onClick={handleSubmit} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar'}</button></>}
      >
        {formError && <div className="form-error-box">{formError}</div>}
        <form className="form-grid" onSubmit={handleSubmit} noValidate>

          <div className="form-group span-2">
            <div className="form-avatar-row">
              <ImageUploader
                preview={fotoPreview}
                onChange={handlePhotoChange}
                size={60}
                initials={formData.Nombre?.charAt(0)?.toUpperCase()}
              />
              <div style={{ flex: 1 }}>
                <label className="form-label">Nombre <span className="required">*</span></label>
                <input name="Nombre" className="form-control" value={formData.Nombre} onChange={handleChange} placeholder="Nombre completo" />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Rol <span className="required">*</span></label>
            <SearchableSelect
              options={rolesOpts}
              value={String(formData.Id_Rol)}
              onChange={v => setFormData(p => ({ ...p, Id_Rol: v }))}
              placeholder="Seleccionar rol..."
              disabled={!!(editingId && formData.Id_Rol == 1)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tipo de documento <span className="required">*</span></label>
            <SearchableSelect
              options={tiposDocOpts}
              value={String(formData.Id_TipoDoc)}
              onChange={v => setFormData(p => ({ ...p, Id_TipoDoc: v }))}
              placeholder="Seleccionar tipo..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Número de documento <span className="required">*</span></label>
            <input name="Documento" className="form-control" value={formData.Documento} onChange={handleChange} placeholder="Número de documento" />
          </div>

          <div className="form-group">
            <label className="form-label">Correo electrónico <span className="required">*</span></label>
            <input name="Correo" type="email" className="form-control" value={formData.Correo} onChange={handleChange} placeholder="correo@empresa.com" />
          </div>

          <div className="form-group">
            <label className="form-label">
              Contraseña {!editingId && <span className="required">*</span>}
              {editingId && <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: '4px' }}>(dejar vacío para no cambiar)</span>}
            </label>
            <div className="form-password-wrap">
              <input name="Password" type={showPassword ? 'text' : 'password'} className="form-control" value={formData.Password} onChange={handleChange} placeholder={editingId ? 'Nueva contraseña' : 'Contraseña'} />
              <button type="button" className="form-password-toggle" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
              </button>
            </div>
          </div>

        </form>
      </Modal>
    </div>
  );
}
