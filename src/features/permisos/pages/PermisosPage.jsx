import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdEdit, MdLock, MdCheck, MdClose } from 'react-icons/md';
import { fetchPermisos, createPermiso, updatePermiso, togglePermisoEstado } from '../slices/permisosSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { filterItems } from '../../../shared/utils/helpers.js';
import './PermisosPage.css';

export default function PermisosPage() {
  const dispatch = useDispatch();
  const { items, loading, actionLoading } = useSelector(s => s.permisos);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [pageSize, setPageSize] = useState(10);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createNombre, setCreateNombre] = useState('');
  const [createError, setCreateError] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => { dispatch(fetchPermisos()); }, [dispatch]);

  const startInlineEdit = (item) => {
    setEditingId(item.Id_Permiso);
    setEditingValue(item.Nombre);
  };

  const cancelInlineEdit = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const saveInlineEdit = async () => {
    if (!editingValue.trim() || !editingId) return;
    const result = await dispatch(updatePermiso({ id: editingId, data: { Nombre: editingValue.trim() } }));
    if (!result.error) {
      cancelInlineEdit();
      dispatch(fetchPermisos());
    }
  };

  const handleInlineKeyDown = (e) => {
    if (e.key === 'Enter') saveInlineEdit();
    if (e.key === 'Escape') cancelInlineEdit();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createNombre.trim()) { setCreateError('El nombre es obligatorio.'); return; }
    const result = await dispatch(createPermiso({ Nombre: createNombre.trim() }));
    if (!result.error) {
      setShowCreate(false);
      setCreateNombre('');
      dispatch(fetchPermisos());
    } else {
      setCreateError(result.payload || 'Error al crear.');
    }
  };

  const afterSearch = filterItems(items, search, ['Nombre']);
  const filtered = statusFilter === 'activos'
    ? afterSearch.filter(p => p.Estado === 1)
    : statusFilter === 'inactivos'
      ? afterSearch.filter(p => p.Estado === 0)
      : afterSearch;

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    {
      key: 'Nombre', label: 'Módulo', render: (v, row) => {
        if (editingId === row.Id_Permiso) {
          return (
            <div className="inline-edit">
              <input
                className="inline-edit__input"
                value={editingValue}
                onChange={e => setEditingValue(e.target.value)}
                onKeyDown={handleInlineKeyDown}
                autoFocus
              />
              <button className="btn btn--ghost btn--icon btn--sm" onClick={saveInlineEdit} title="Guardar">
                <MdCheck size={16} style={{ color: '#16a34a' }} />
              </button>
              <button className="btn btn--ghost btn--icon btn--sm" onClick={cancelInlineEdit} title="Cancelar">
                <MdClose size={16} />
              </button>
            </div>
          );
        }
        return (
          <div className="perm-name-cell">
            <span className="perm-icon"><MdLock size={15} /></span>
            <span className="font-medium">{v}</span>
            <button
              className="btn btn--ghost btn--icon btn--sm perm-edit-inline-btn"
              onClick={() => startInlineEdit(row)}
              title="Editar nombre"
            >
              <MdEdit size={15} />
            </button>
          </div>
        );
      }
    },
    {
      key: 'Estado', label: 'Estado', render: (v, row) => (
        <ToggleSwitch checked={v === 1} onChange={() => dispatch(togglePermisoEstado(row.Id_Permiso))} />
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Permisos</h1>
          <p className="page__subtitle">Módulos del sistema — {items.length} registrado(s)</p>
        </div>
        <button className="btn btn--primary" onClick={() => { setCreateNombre(''); setCreateError(''); setShowCreate(true); }}>
          <MdAdd size={18} />Nuevo permiso
        </button>
      </div>

      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar módulo..."
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
        <Table columns={columns} data={filtered} loading={loading} pageSize={pageSize} emptyMessage="No se encontraron permisos" />
      </div>

      {/* Create modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo módulo"
        size="sm"
        footer={
          <>
            <button className="btn btn--outline" onClick={() => setShowCreate(false)}>Cancelar</button>
            <button className="btn btn--primary" onClick={handleCreate} disabled={actionLoading}>
              {actionLoading ? 'Guardando...' : 'Crear'}
            </button>
          </>
        }
      >
        {createError && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', borderRadius: '8px', color: '#dc2626', fontSize: '0.875rem' }}>
            {createError}
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Nombre del módulo <span className="required">*</span></label>
          <input
            className="form-control"
            value={createNombre}
            onChange={e => setCreateNombre(e.target.value)}
            placeholder="Ej: Reportes"
            onKeyDown={e => e.key === 'Enter' && handleCreate(e)}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
