import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { MdSecurity, MdPerson, MdPeople, MdDeleteForever, MdCleaningServices } from 'react-icons/md';
import { cuentasService } from '../services/cuentasService.js';
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh.js';
import { useBorradoReal } from '../../../shared/hooks/useBorradoReal.js';
import { rolesService } from '../../roles/services/rolesService.js';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import EliminarRealModal from '../../../shared/components/EliminarRealModal/EliminarRealModal.jsx';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Badge from '../../../shared/components/Badge/Badge.jsx';
import { useToast } from '../../../shared/components/Toast/ToastContext.jsx';
import { filterItems, getErrorMessage, formatDate, todayLocalYMD } from '../../../shared/utils/helpers.js';
import './CuentasPage.css';

const TEXTO_LIMPIEZA = 'ELIMINAR CUENTAS INACTIVAS';

// Gestión unificada de cuentas (Fase 3 — normalización): cada Cliente con correo y cada
// Empleado aparece aquí. Promover/degradar rol y borrado real son exclusivos del Super
// Administrador (el backend también lo exige, esto solo evita clicks inútiles). El estado
// activo/inactivo se gestiona en Empleados/Clientes -- aquí solo se limpia (borra).
export default function CuentasPage() {
  const currentUserId = useSelector(s => s.auth.empleado?.id_empleado ?? s.auth.cliente?.Id_Cliente);
  const currentUserTipo = useSelector(s => s.auth.tipo);
  const esSuperadmin = useSelector(s => s.auth.empleado?.EsSuperAdmin === true);
  const { addToast } = useToast();

  const [cuentas, setCuentas] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rowError, setRowError] = useState(null); // { key, message }
  const [busyKey, setBusyKey] = useState(null);

  // Adaptador: useBorradoReal fija el service al crear el hook, pero cada fila puede ser
  // un cliente o un empleado (services distintos) -- el ref guarda cuál le toca a la
  // fila que se está abriendo justo antes de llamarlo.
  const delTipoRef = useRef(null);
  const delService = useMemo(() => ({
    getDependencias: (id) => cuentasService.getDependencias(delTipoRef.current, id),
    eliminar: (id, confirmacion) => cuentasService.eliminar(delTipoRef.current, id, confirmacion),
  }), []);
  const del = useBorradoReal(delService, { entidadLabel: 'cuenta', onDeleted: () => cargar() });

  const [showLimpieza, setShowLimpieza] = useState(false);
  const [limpiezaFecha, setLimpiezaFecha] = useState('');
  const [limpiezaPreview, setLimpiezaPreview] = useState(null);
  const [limpiezaLoading, setLimpiezaLoading] = useState(false);
  const [limpiezaTexto, setLimpiezaTexto] = useState('');
  const [limpiezaEjecutando, setLimpiezaEjecutando] = useState(false);
  const [limpiezaError, setLimpiezaError] = useState('');

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

  useAutoRefresh(() => cargar(), { intervalMs: 20000, enabled: !busyKey && !del.isOpen && !showLimpieza });

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

  const esUnoMismo = (row) => row.TipoOrigen === currentUserTipo && String(row.IdOrigen) === String(currentUserId);

  // Los Super Administrador nunca se pueden borrar desde acá (protección del backend,
  // ver borradoProtegido.js / empleado.service.js::_protegido) -- ni siquiera entre
  // superadmins, así que el botón ni se muestra para esas filas.
  const abrirEliminar = (row) => {
    delTipoRef.current = row.TipoOrigen;
    del.open(row.IdOrigen);
  };

  // Limpieza masiva: cuentas INACTIVAS creadas antes de la fecha elegida (no toca las
  // que siguen usándose). Igual que el borrado individual, nunca incluye Super
  // Administrador ni la cuenta protegida del sistema.
  const abrirLimpieza = () => {
    setShowLimpieza(true);
    setLimpiezaFecha('');
    setLimpiezaPreview(null);
    setLimpiezaTexto('');
    setLimpiezaError('');
  };

  const buscarCandidatosLimpieza = async (fecha) => {
    setLimpiezaFecha(fecha);
    setLimpiezaPreview(null);
    setLimpiezaTexto('');
    setLimpiezaError('');
    if (!fecha) return;
    setLimpiezaLoading(true);
    try {
      const r = await cuentasService.limpiezaPreview(fecha);
      setLimpiezaPreview(r?.data || r);
    } catch (err) {
      setLimpiezaError(getErrorMessage(err));
    } finally {
      setLimpiezaLoading(false);
    }
  };

  const confirmarLimpieza = async () => {
    setLimpiezaEjecutando(true);
    setLimpiezaError('');
    try {
      const r = await cuentasService.limpiezaEjecutar(limpiezaFecha, limpiezaTexto.trim());
      const { eliminados = [], omitidos = [] } = r?.data || r || {};
      addToast({
        type: 'success',
        message: `Limpieza completa: ${eliminados.length} cuenta(s) eliminada(s)${omitidos.length ? `, ${omitidos.length} omitida(s) por tener historial` : ''}.`,
      });
      setShowLimpieza(false);
      cargar();
    } catch (err) {
      setLimpiezaError(getErrorMessage(err));
    } finally {
      setLimpiezaEjecutando(false);
    }
  };

  const candidatos = limpiezaPreview?.candidatos || [];
  const elegibles = candidatos.filter(c => c.puedeEliminar);
  const bloqueados = candidatos.filter(c => !c.puedeEliminar);
  const textoLimpiezaOk = limpiezaTexto.trim() === TEXTO_LIMPIEZA;

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
      key: 'acciones', label: 'Acciones', render: (_, row) => (
        <div className="table-actions">
          {esSuperadmin && !row.EsSuperAdmin && (
            <button
              className="btn btn--ghost btn--icon btn--sm btn--danger-ghost"
              title="Eliminar cuenta"
              onClick={() => abrirEliminar(row)}
            >
              <MdDeleteForever size={17} />
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
          <h1 className="page__title">Cuentas y accesos</h1>
          <p className="page__subtitle">{cuentas.length} cuenta(s) — clientes y empleados con acceso al sistema</p>
        </div>
        {esSuperadmin && (
          <button className="btn btn--outline" onClick={abrirLimpieza}>
            <MdCleaningServices size={17} /> Limpieza de cuentas inactivas
          </button>
        )}
      </div>

      {rowError && <div className="form-error-box u-mb-md">{rowError.message}</div>}

      <div className="card">
        <div className="card__header">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, correo, documento..." />
        </div>
        <Table columns={columns} rowKey={keyOf} data={filtered} loading={loading} pageSize={10} emptyMessage="No se encontraron cuentas" />
      </div>

      <EliminarRealModal
        isOpen={del.isOpen} onClose={del.close} entidadLabel="cuenta"
        preview={del.preview} loadingPreview={del.loadingPreview} deleting={del.deleting} error={del.error} onConfirm={del.confirm}
      />

      <Modal
        isOpen={showLimpieza}
        onClose={() => setShowLimpieza(false)}
        title="Limpieza de cuentas inactivas"
        size="md"
        footer={limpiezaPreview && elegibles.length > 0 ? (
          <>
            <button className="btn btn--outline" onClick={() => setShowLimpieza(false)} disabled={limpiezaEjecutando}>Cancelar</button>
            <button className="btn btn--danger" disabled={!textoLimpiezaOk || limpiezaEjecutando} onClick={confirmarLimpieza}>
              <MdDeleteForever size={17} /> {limpiezaEjecutando ? 'Eliminando…' : `Eliminar ${elegibles.length} cuenta(s)`}
            </button>
          </>
        ) : (
          <button className="btn btn--outline" onClick={() => setShowLimpieza(false)}>Cerrar</button>
        )}
      >
        <p className="del-modal__lead" style={{ marginBottom: '1rem' }}>
          Elimina de forma permanente las cuentas <strong>inactivas</strong> (clientes y empleados) creadas antes de la fecha
          que elijas. Nunca incluye Super Administradores ni la cuenta protegida del sistema, y omite cualquiera que
          tenga historial real (órdenes, novedades) aunque esté antes de esa fecha.
        </p>
        <div className="form-group">
          <label className="form-label">Eliminar cuentas inactivas creadas antes de</label>
          <input
            type="date"
            className="form-control"
            max={todayLocalYMD()}
            value={limpiezaFecha}
            onChange={e => buscarCandidatosLimpieza(e.target.value)}
          />
        </div>

        {limpiezaLoading && <p className="del-modal__loading">Buscando cuentas…</p>}

        {!limpiezaLoading && limpiezaPreview && (
          candidatos.length === 0 ? (
            <p className="empty-list">No hay cuentas inactivas creadas antes de esa fecha.</p>
          ) : (
            <>
              <div className="cuentas-limpieza-lista u-mb-md" style={{ maxHeight: 220, overflowY: 'auto' }}>
                {elegibles.map(c => (
                  <div key={`${c.TipoOrigen}-${c.IdOrigen}`} className="cuentas-limpieza-item">
                    <span className="cuentas-limpieza-item__nombre">{c.Nombre} <small>· {c.Correo}</small></span>
                    <span className="cuentas-limpieza-item__fecha">{formatDate(c.createdAt)}</span>
                  </div>
                ))}
                {bloqueados.map(c => (
                  <div key={`${c.TipoOrigen}-${c.IdOrigen}`} className="cuentas-limpieza-item cuentas-limpieza-item--omitida">
                    <span className="cuentas-limpieza-item__nombre">{c.Nombre}</span>
                    <span className="cuentas-limpieza-item__motivo">Omitida: {c.motivoBloqueo || 'tiene historial'}</span>
                  </div>
                ))}
              </div>

              {elegibles.length > 0 && (
                <div className="form-group">
                  <label className="form-label del-modal__confirm-label">
                    Para confirmar, escribe: <code>{TEXTO_LIMPIEZA}</code>
                  </label>
                  <input
                    className="form-control"
                    value={limpiezaTexto}
                    onChange={e => setLimpiezaTexto(e.target.value)}
                    placeholder={TEXTO_LIMPIEZA}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              )}
            </>
          )
        )}

        {limpiezaError && <div className="form-error-box">{limpiezaError}</div>}
      </Modal>
    </div>
  );
}
