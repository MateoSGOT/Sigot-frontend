import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { MdSecurity, MdPerson, MdPeople } from 'react-icons/md';
import { cuentasService } from '../services/cuentasService.js';
import { rolesService } from '../../roles/services/rolesService.js';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import Badge, { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { filterItems, getErrorMessage } from '../../../shared/utils/helpers.js';
import './CuentasPage.css';

// Gestión unificada de cuentas (Fase 3 — normalización): cada Cliente con correo y cada
// Empleado aparece aquí. Promover/degradar rol y activar/desactivar es exclusivo del
// Super Administrador (el backend también lo exige, esto solo evita clicks inútiles).
export default function CuentasPage() {
  const currentUserId = useSelector(s => s.auth.empleado?.id_empleado ?? s.auth.cliente?.Id_Cliente);
  const currentUserTipo = useSelector(s => s.auth.tipo);

  const [cuentas, setCuentas] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rowError, setRowError] = useState(null); // { key, message }
  const [busyKey, setBusyKey] = useState(null);

  const cargar = () => {
    setLoading(true);
    Promise.all([cuentasService.getAll(), rolesService.getAll()])
      .then(([cuentasRes, rolesRes]) => {
        setCuentas(cuentasRes?.data || []);
        setRoles((rolesRes?.data || []).filter(r => r.Estado !== 0));
      })
      .catch(() => { setCuentas([]); setRoles([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const rolesOpts = useMemo(() => roles.map(r => ({ value: String(r.Id_Rol), label: r.Nombre })), [roles]);

  const filtered = filterItems(cuentas, search, ['Nombre', 'Correo', 'Documento']);

  const keyOf = (row) => `${row.TipoOrigen}-${row.IdOrigen}`;

  const handleCambiarRol = async (row, idRolStr) => {
    const key = keyOf(row);
    setBusyKey(key); setRowError(null);
    try {
      await cuentasService.cambiarRol(row.TipoOrigen, row.IdOrigen, idRolStr ? Number(idRolStr) : null);
      cargar();
    } catch (err) {
      setRowError({ key, message: getErrorMessage(err) });
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleEstado = async (row) => {
    const key = keyOf(row);
    setBusyKey(key); setRowError(null);
    try {
      await cuentasService.cambiarEstado(row.TipoOrigen, row.IdOrigen, row.Estado === 0 || row.Estado === false);
      cargar();
    } catch (err) {
      setRowError({ key, message: getErrorMessage(err) });
    } finally {
      setBusyKey(null);
    }
  };

  const esUnoMismo = (row) => row.TipoOrigen === currentUserTipo && String(row.IdOrigen) === String(currentUserId);

  const columns = [
    { key: '#', label: '#', width: '50px', render: (_, __, i) => i + 1 },
    {
      key: 'Nombre', label: 'Nombre', render: (v, row) => (
        <div className="cell-user">
          <div className="cell-user__avatar cell-user__avatar--initial">{v?.charAt(0)}</div>
          <span className="font-medium">{v}</span>
          {esUnoMismo(row) && <Badge variant="gray" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>Tú</Badge>}
        </div>
      )
    },
    { key: 'Correo', label: 'Correo' },
    { key: 'Documento', label: 'Documento', render: v => v || '—' },
    {
      key: 'TipoOrigen', label: 'Tipo', render: v => (
        <Badge variant={v === 'empleado' ? 'info' : 'gray'}>
          {v === 'empleado' ? <><MdPeople size={12} className="u-ic-mr" />Empleado</> : <><MdPerson size={12} className="u-ic-mr" />Cliente</>}
        </Badge>
      )
    },
    {
      key: 'Id_Rol', label: 'Rol', render: (v, row) => (
        <div className="cuentas-rol-cell">
          <select
            className="form-control form-control--sm"
            value={v != null ? String(v) : ''}
            disabled={busyKey === keyOf(row)}
            onChange={e => handleCambiarRol(row, e.target.value)}
          >
            <option value="">Sin rol administrativo</option>
            {rolesOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {row.EsSuperAdmin && <Badge variant="success"><MdSecurity size={11} className="u-ic-mr" />Super Admin</Badge>}
        </div>
      )
    },
    {
      key: 'Estado', label: 'Estado', render: (v, row) => (
        <div className="table-actions">
          <StatusBadge estado={v} />
          <ToggleSwitch checked={v === 1 || v === true} onChange={() => handleToggleEstado(row)} disabled={busyKey === keyOf(row)} />
        </div>
      )
    },
  ];

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Cuentas y accesos</h1>
          <p className="page__subtitle">{cuentas.length} cuenta(s) — clientes y empleados con acceso al sistema</p>
        </div>
      </div>

      {rowError && <div className="form-error-box u-mb-md">{rowError.message}</div>}

      <div className="card">
        <div className="card__header">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, correo, documento..." />
        </div>
        <Table columns={columns} rowKey={keyOf} data={filtered} loading={loading} pageSize={10} emptyMessage="No se encontraron cuentas" />
      </div>
    </div>
  );
}
