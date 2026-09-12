import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { MdAdd, MdVisibility, MdEdit, MdWarning, MdTableChart, MdDeleteForever, MdUploadFile, MdCheckCircle } from 'react-icons/md';
import { useBorradoReal } from '../../../shared/hooks/useBorradoReal.js';
import { repuestosService } from '../services/repuestosService.js';
import EliminarRealModal from '../../../shared/components/EliminarRealModal/EliminarRealModal.jsx';
import { usePermiso } from '../../../shared/hooks/usePermiso.js';
import * as XLSX from 'xlsx';
import ToggleSwitch from '../../../shared/components/ToggleSwitch/ToggleSwitch.jsx';
import { createRepuesto, updateRepuesto, toggleRepuestoEstado } from '../slices/repuestosSlice.js';
import { createCategoria } from '../../categorias/slices/categoriasSlice.js';
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import SearchableSelect from '../../../shared/components/SearchableSelect/SearchableSelect.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { formatCurrency, todayLocalYMD } from '../../../shared/utils/helpers.js';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import api from '../../../shared/services/api.js';
import './RepuestosPage.css';

// El repuesto es una ficha de catálogo: Stock y Costo (Precio) se llenan al comprar, no al crear.
// El margen ya no tiene piso fijo (antes 50%) -- el taller puede vender con un margen
// más bajo si lo necesita (ej. competir en precio); el precio de venta se calcula
// igual (costo × margen × IVA).
const EMPTY = { NombreRepuesto: '', StockMinimo: '5', Id_categoria: '', MargenPorcentaje: '50', _costo: 0, _iva: 19, _precioVenta: null };
// Busca una categoría YA EXISTENTE por nombre contra el catálogo actual del servidor --
// no contra el estado `categorias` cargado al montar la página, que puede estar
// desactualizado si la categoría se creó en una corrida anterior de este mismo import (o
// manualmente) después de que la página cargó. Se usa como respaldo cuando createCategoria
// falla: antes, cualquier categoría ya existente (ej. "Polea" de una corrida anterior)
// tumbaba TODOS los repuestos de esa categoría uno por uno durante el resto del import,
// porque nunca se resolvía su Id_categoria real. `cache` es un objeto mutable simple
// ({ current: null }) creado una vez por corrida de import -- se llena con un solo GET la
// primera vez que se necesita, y se reutiliza para el resto de la corrida (una categoría
// resuelta así queda en catByName y no vuelve a pasar por aquí).
async function _resolverCategoriaExistente(nombre, cache) {
  if (!cache.current) {
    try {
      const r = await api.get('/api/categoria-repuestos');
      cache.current = r.data?.data || r.data || [];
    } catch { cache.current = []; }
  }
  const objetivo = nombre.trim().toLowerCase();
  const match = cache.current.find(c => String(c.Nombre ?? c.nombre ?? '').trim().toLowerCase() === objetivo);
  return match ? (match.Id_categoria ?? match.Id_Categoria ?? null) : null;
}

// Agrupa la lista de fallos { nombre, motivo } en { motivo: [nombre, ...] }, ordenado por
// cuántos ítems tiene cada motivo (el más frecuente primero) -- así el panel de resultados
// muestra "18 repuestos: <motivo real>" en vez de una lista plana de 18 nombres sin contexto.
function _agruparPorMotivo(faltantes) {
  const grupos = {};
  faltantes.forEach(({ nombre, motivo }) => {
    const key = motivo || 'Motivo desconocido';
    (grupos[key] = grupos[key] || []).push(nombre);
  });
  return Object.fromEntries(Object.entries(grupos).sort((a, b) => b[1].length - a[1].length));
}

const _sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Pausa entre filas del import de Excel: con hasta 2 solicitudes por fila (categoría +
// repuesto) y archivos reales de cientas de filas, sin ninguna pausa el import dispara
// cientos de solicitudes seguidas en pocos segundos -- mala práctica de todas formas,
// con o sin límite en el servidor (ver globalLimiter en app.js, API).
const PAUSA_ENTRE_FILAS_MS = 60;

const RULES = {
  NombreRepuesto: (v) => V.nombre(v, 3, 120),
  Id_categoria:   (v) => V.requiredSelect(v, 'La categoría'),
  MargenPorcentaje: (v) => {
    if (v == null || String(v).trim() === '') return ''; // opcional; queda en su default 50
    const n = Number(v);
    if (Number.isNaN(n)) return 'El margen debe ser un número.';
    if (n < 0) return 'El margen de ganancia no puede ser negativo.';
    if (n > 1000) return 'El margen no puede superar el 1000%.';
    return '';
  },
};

// Panel de resultados de la importación de Excel, con jerarquía visual clara en vez de
// un solo bloque de alerta homogéneo: éxito (verde) / advertencias menores de dato
// incompleto (ámbar) / errores reales agrupados por motivo (rojo, colapsados por
// defecto con un contador -- expandibles para ver los nombres). Los errores se agrupan
// por el motivo REAL que devolvió la API (ver _agruparPorMotivo), no por orden de
// aparición -- así un problema que afecta a muchos repuestos por la misma razón se lee
// de un vistazo en vez de como una lista plana.
function ImportResumenPanel({ importMsg, onClose }) {
  if (importMsg.error) {
    return (
      <div className="import-resumen import-resumen--fatal">
        <span>{importMsg.error}</span>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>Cerrar</button>
      </div>
    );
  }

  const rr = importMsg.resumenReal;
  const catsOrdenadas = rr ? Object.entries(rr.porCategoria).sort((a, b) => b[1] - a[1]) : [];
  const portaCount = rr?.porCategoria?.['Porta'] || 0;
  const motivos = Object.entries(importMsg.fallosPorMotivo || {});
  const hayAdvertencias = !!rr && (rr.sinDescripcion > 0 || rr.sinLote > 0 || rr.fallbackSinFecha?.length > 0 || portaCount > 10);
  // Tope defensivo de nombres mostrados por motivo (un import real puede tener cientos de
  // filas repitiendo el mismo motivo) -- el conteo del <summary> siempre es el real.
  const TOPE_NOMBRES = 60;

  return (
    <div className="import-resumen">
      <div className="import-resumen__row import-resumen__row--header">
        <span className="import-resumen__title">Resultado de la importación</span>
        <button className="btn btn--ghost btn--sm" onClick={onClose} style={{ marginLeft: 'auto' }}>Cerrar</button>
      </div>

      <div className="import-resumen__tier import-resumen__tier--ok">
        <span>✓ {importMsg.ok} repuesto(s) creado(s).</span>
        {importMsg.categoriasCreadas > 0 && <span>{importMsg.categoriasCreadas} categoría(s) nueva(s) creada(s).</span>}
        {importMsg.categoriasRecuperadas > 0 && <span>{importMsg.categoriasRecuperadas} categoría(s) ya existían (reutilizadas automáticamente, sin error).</span>}
      </div>

      {hayAdvertencias && (
        <div className="import-resumen__tier import-resumen__tier--warn">
          {rr.sinDescripcion > 0 && <p>⚠ {rr.sinDescripcion} repuesto(s) sin descripción en el archivo (se usó el código como nombre).</p>}
          {rr.sinLote > 0 && <p>⚠ {rr.sinLote} repuesto(s) sin ningún lote asociado (Precio/Margen quedaron en los valores por defecto).</p>}
          {rr.fallbackSinFecha?.length > 0 && (
            <p>⚠ {rr.fallbackSinFecha.length} código(s) con más de un lote donde no se pudo determinar cuál es el más reciente por fecha (se usó el último que aparece en la hoja Lotes): {rr.fallbackSinFecha.slice(0, 10).join(', ')}{rr.fallbackSinFecha.length > 10 ? '…' : ''}.</p>
          )}
          {portaCount > 10 && (
            <p style={{ fontWeight: 700 }}>⚠ La categoría "Porta" agrupó {portaCount} repuestos distintos -- revisa si conviene dividirla en categorías más específicas desde el módulo de Categorías.</p>
          )}
        </div>
      )}

      {rr && (
        <details className="import-resumen__detail">
          <summary>Ver {catsOrdenadas.length} categoría(s) y cuántos repuestos tiene cada una</summary>
          <ul>
            {catsOrdenadas.map(([nombre, cantidad]) => <li key={nombre}>{nombre}: {cantidad}</li>)}
          </ul>
        </details>
      )}

      {importMsg.fail > 0 && (
        <div className="import-resumen__tier import-resumen__tier--error">
          <p className="import-resumen__error-heading">✕ {importMsg.fail} repuesto(s) no se pudieron importar:</p>
          {motivos.map(([motivo, nombres]) => (
            <details key={motivo} className="import-resumen__detail import-resumen__detail--error">
              <summary>{nombres.length} repuesto(s): {motivo}</summary>
              <ul>
                {nombres.slice(0, TOPE_NOMBRES).map((n, i) => <li key={`${n}-${i}`}>{n}</li>)}
                {nombres.length > TOPE_NOMBRES && <li>… y {nombres.length - TOPE_NOMBRES} más.</li>}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

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
      // Estado viene como booleano crudo de Postgres (paginación server-side, sin pasar por
      // el norm() del slice) -- sin este mapeo el ToggleSwitch (que compara === 1) siempre
      // se ve apagado, sin importar el estado real.
      setRows((r.data?.data || []).map(x => ({ ...x, Nombre: x.NombreRepuesto || x.Nombre || '', Estado: x.Estado === true ? 1 : x.Estado === false ? 0 : x.Estado })));
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
  // Overlay de progreso: 'idle' (oculto) | 'loading' (barra + %) | 'done' (check verde,
  // se muestra un instante antes de cerrarse). importProgress es el % (0-100) mostrado
  // mientras se procesan las filas del Excel, fila por fila.
  const [importOverlay, setImportOverlay] = useState('idle');
  const [importProgress, setImportProgress] = useState(0);
  // Igual que Modal.jsx: bloquea el scroll del body mientras el overlay está abierto.
  useEffect(() => {
    document.body.style.overflow = importOverlay !== 'idle' ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [importOverlay]);

  // --- Importación del INVENTARIO REAL (formato multi-hoja Repuesto/Lotes/Entradas) ---
  // Se detecta por la presencia de una hoja "Repuesto" y una hoja "Lotes" en el mismo
  // libro; si no calzan esos nombres, se usa el importador genérico de una sola hoja
  // de siempre (más abajo), sin ningún cambio de comportamiento.
  const _buscarHoja = (wb, re) => wb.SheetNames.find(n => re.test(n.trim()));
  // Mismo detector de encabezado (primera fila con contenido) que ya usa el importador
  // genérico, factorizado para reusarlo con las 3 hojas del formato real.
  const _parsearHoja = (wb, nombreHoja) => {
    if (!nombreHoja) return [];
    const ws = wb.Sheets[nombreHoja];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const headerIdx = Math.max(0, raw.findIndex(r => r.some(c => String(c).trim() !== '')));
    const headers = raw[headerIdx] || [];
    return raw.slice(headerIdx + 1)
      .filter(r => r.some(c => String(c).trim() !== ''))
      .map((r, i) => { const o = { __rowIdx: i }; headers.forEach((h, j) => { const k = String(h).trim(); if (k) o[k] = r[j] ?? ''; }); return o; });
  };
  const _tituloCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');
  const _primeraPalabra = (desc) => {
    const m = String(desc || '').trim().match(/[A-Za-zÁÉÍÓÚÑÜáéíóúñü]+/);
    return m ? _tituloCase(m[0]) : null;
  };
  const _parseFechaExcel = (v) => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') { const d = XLSX.SSF.parse_date_code(v); return d ? new Date(d.y, d.m - 1, d.d) : null; }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  const importInventarioReal = async (wb) => {
    const repuestoRows = _parsearHoja(wb, _buscarHoja(wb, /^repuesto$/i));
    const lotesRows    = _parsearHoja(wb, _buscarHoja(wb, /^lotes$/i));
    const entradasRows = _parsearHoja(wb, _buscarHoja(wb, /^entradas$/i));

    const entradasByCodigo = {};
    entradasRows.forEach(r => { const c = String(r.Codigo || '').trim(); if (c) entradasByCodigo[c] = r; });
    const lotesByRepuesto = {};
    lotesRows.forEach(r => {
      const c = String(r['Repuesto'] || '').trim();
      if (c) (lotesByRepuesto[c] = lotesByRepuesto[c] || []).push(r);
    });

    // Un repuesto puede tener varios lotes (varias compras históricas). Se usa el de
    // fecha más reciente si se puede resolver (Lotes.Entrada → Entradas.Codigo → "Fecha
    // de compra"); si ningún lote candidato tiene fecha real, se usa el último que
    // aparece en la hoja Lotes y se reporta al final (en el archivo real, casi ningún
    // registro de Entradas trae fecha, así que este fallback es la regla, no la excepción).
    const fallbackSinFecha = [];
    const elegirLote = (codigo) => {
      const candidatos = lotesByRepuesto[codigo] || [];
      if (candidatos.length === 0) return null;
      if (candidatos.length === 1) return candidatos[0];
      const conFecha = candidatos
        .map(l => {
          const entrada = entradasByCodigo[String(l['Entrada'] || '').trim()];
          return { lote: l, fecha: entrada ? _parseFechaExcel(entrada['Fecha de compra']) : null };
        })
        .filter(x => x.fecha != null);
      if (conFecha.length > 0) {
        conFecha.sort((a, b) => b.fecha - a.fecha);
        return conFecha[0].lote;
      }
      fallbackSinFecha.push(codigo);
      return candidatos.reduce((max, l) => (l.__rowIdx > max.__rowIdx ? l : max), candidatos[0]);
    };

    const catByName = {};
    categorias.forEach(c => { const n = String(c.Nombre ?? c.nombre ?? '').trim().toLowerCase(); if (n) catByName[n] = c.Id_categoria ?? c.Id_Categoria; });
    const SIN_CATEGORIA = 'Sin categoría';

    let ok = 0, fail = 0, categoriasCreadas = 0, categoriasRecuperadas = 0, sinDescripcion = 0, sinLote = 0;
    const porCategoria = {};
    const faltantes = []; // { nombre, motivo }
    const categoriasFrescasCache = { current: null };

    for (let i = 0; i < repuestoRows.length; i++) {
      if (i > 0) await _sleep(PAUSA_ENTRE_FILAS_MS);
      const fila = repuestoRows[i];
      setImportProgress(Math.round(((i + 1) / repuestoRows.length) * 100));
      const codigo = String(fila.Codigo || '').trim();
      // Filas de relleno del archivo real (sin código ni ningún otro dato): se descartan,
      // no representan ningún repuesto.
      if (!codigo) continue;
      const descripcion = String(fila.Descripcion || '').trim();
      // Código real con Descripción vacía (dato incompleto del archivo real): se usa el
      // código como nombre de respaldo -- mejor importarlo identificado por su código
      // que perder del inventario un ítem con stock real.
      const nombre = descripcion || codigo;
      if (!descripcion) sinDescripcion++;

      // Categoría automática: primera palabra de la Descripción, normalizada a
      // formato título (ej. "Suichet", "Bombillo"). Sin Descripción reconocible → "Sin categoría".
      const catNombre = descripcion ? (_primeraPalabra(descripcion) || SIN_CATEGORIA) : SIN_CATEGORIA;
      const catKey = catNombre.toLowerCase();
      let idCat = catByName[catKey];
      let motivoFallo = null;
      if (!idCat) {
        const rCat = await dispatch(createCategoria({ Nombre: catNombre }));
        if (!rCat.error && rCat.payload?.Id_categoria) {
          idCat = rCat.payload.Id_categoria;
          catByName[catKey] = idCat;
          if (catKey !== SIN_CATEGORIA.toLowerCase()) categoriasCreadas++;
        } else {
          // La creación falló -- el caso más común es que la categoría YA exista (de una
          // corrida anterior de este mismo import): se busca en el catálogo actual antes
          // de dar el ítem por perdido. Sin esto, todos los repuestos siguientes de esta
          // misma categoría repetían el mismo error uno por uno durante el resto del import.
          const idExistente = await _resolverCategoriaExistente(catNombre, categoriasFrescasCache);
          if (idExistente) {
            idCat = idExistente;
            catByName[catKey] = idCat;
            categoriasRecuperadas++;
          } else {
            motivoFallo = rCat.payload || 'No se pudo crear la categoría';
          }
        }
      }
      if (!idCat) { fail++; faltantes.push({ nombre, motivo: motivoFallo || 'Categoría no disponible' }); continue; }

      const lote = elegirLote(codigo);
      const payload = { NombreRepuesto: nombre, Id_categoria: idCat, Stock: Number(fila.Stock || 0) || 0 };
      if (lote) {
        const costo  = Number(lote['Prc con dsc']);
        const margen = Number(lote['Margen de ganancia']) * 100;
        const precioVentaReal = Number(lote['Precio de venta']);
        if (!isNaN(costo))  payload.Precio = costo;
        if (!isNaN(margen)) payload.MargenPorcentaje = margen;
        // PrecioVenta se importa TAL CUAL del archivo (punto de partida real del
        // inventario que el taller ya tenía comprado), sin recalcular con la fórmula
        // estándar -- la SIGUIENTE compra que se registre para este repuesto en el
        // sistema sí recalculará normalmente, como cualquier otro repuesto (ver
        // compra.model.js::create).
        if (!isNaN(precioVentaReal)) payload.PrecioVenta = precioVentaReal;
      } else {
        // Sin ningún lote asociado: se importa solo con Nombre/Categoría/Stock,
        // dejando Precio/Margen en los valores por defecto del backend (0 y 50).
        sinLote++;
      }

      const r = await dispatch(createRepuesto(payload));
      if (r.error) { fail++; faltantes.push({ nombre, motivo: r.payload || 'Error al crear el repuesto' }); }
      else { ok++; porCategoria[catNombre] = (porCategoria[catNombre] || 0) + 1; }
    }

    setImportMsg({
      ok, fail, categoriasCreadas, categoriasRecuperadas, fallosPorMotivo: _agruparPorMotivo(faltantes),
      resumenReal: { sinDescripcion, sinLote, porCategoria, fallbackSinFecha },
    });
    fetchPage();
    api.get('/api/categoria-repuestos').then(r => setCategorias(r.data?.data || r.data || [])).catch(() => {});
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reimportar el mismo archivo
    if (!file) return;
    setImportando(true);
    setImportMsg(null);
    setImportProgress(0);
    setImportOverlay('loading');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });

      // Formato real del taller (varias hojas: Repuesto/Lotes/Entradas/Salidas) --
      // se detecta por la presencia de hojas "Repuesto" y "Lotes" y toma un camino
      // separado con categorización automática y cruce de costos/precio de venta.
      // Cualquier otro archivo (una sola hoja, columnas Nombre/Categoría) sigue el
      // importador genérico de siempre, sin cambios. Ambos caminos comparten el mismo
      // cierre (barra al 100% + check verde) más abajo, antes del catch/finally.
      const esFormatoReal = _buscarHoja(wb, /^repuesto$/i) && _buscarHoja(wb, /^lotes$/i);
      if (esFormatoReal) {
        await importInventarioReal(wb);
        setImportProgress(100);
        setImportOverlay('done');
        await new Promise((resolve) => setTimeout(resolve, 900));
        return;
      }

      const ws = wb.Sheets[wb.SheetNames[0]];
      // No se asume que la fila 1 trae los encabezados: muchos Excel reales (ej. el
      // formato que ya usa el taller) traen una fila en blanco antes del encabezado.
      // Si se usa sheet_to_json normal, esa fila vacía se toma como encabezado y CADA
      // fila del archivo termina sin ninguna columna reconocible (columnas "__EMPTY").
      // Se detecta la primera fila con algún contenido y se usa esa como encabezado.
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const headerIdx = Math.max(0, raw.findIndex(r => r.some(c => String(c).trim() !== '')));
      const headers = raw[headerIdx] || [];
      const filas = raw.slice(headerIdx + 1)
        .filter(r => r.some(c => String(c).trim() !== ''))
        .map(r => { const o = {}; headers.forEach((h, i) => { const k = String(h).trim(); if (k) o[k] = r[i] ?? ''; }); return o; });

      const catByName = {};
      categorias.forEach(c => { const n = String(c.Nombre ?? c.nombre ?? '').trim().toLowerCase(); if (n) catByName[n] = c.Id_categoria ?? c.Id_Categoria; });
      // Si el archivo no trae columna de categoría (ej. inventarios reales que solo
      // tienen código/descripción/stock), se agrupan todos en "Sin categoría" en vez
      // de descartarlos -- la categoría igual se puede corregir después por repuesto.
      const SIN_CATEGORIA = 'sin categoría';
      let ok = 0, fail = 0, categoriasCreadas = 0, categoriasRecuperadas = 0;
      const faltantes = []; // { nombre, motivo }
      const categoriasFrescasCache = { current: null };
      for (let i = 0; i < filas.length; i++) {
        if (i > 0) await _sleep(PAUSA_ENTRE_FILAS_MS);
        const fila = filas[i];
        setImportProgress(Math.round(((i + 1) / filas.length) * 100));
        // Si no hay descripción (dato incompleto en el archivo de origen), se usa el
        // código como respaldo -- mejor importarlo identificado por su código que
        // perderlo del inventario.
        // OJO: con ?? un valor "" (celda vacía) ya cuenta como "definido" y corta la
        // cadena de respaldo ahí mismo -- por eso se recorre una lista y se toma el
        // primer candidato con contenido real, en vez de encadenar ??.
        const nombreCandidatos = [fila.Nombre, fila.NombreRepuesto, fila.nombre, fila.Descripcion, fila.descripcion, fila.Codigo, fila.codigo];
        const nombre = String(nombreCandidatos.find(v => v != null && String(v).trim() !== '') ?? '').trim();
        const catNombreOrig = String(fila['Categoría'] ?? fila.Categoria ?? fila.categoria ?? '').trim() || 'Sin categoría';
        const catNombre    = catNombreOrig.toLowerCase();
        let idCat = catByName[catNombre];
        let motivoFallo = null;
        // Si la categoría no existe todavía (incluida "Sin categoría"), se crea sobre la
        // marcha -- así una sola importación de repuestos no depende de haber importado
        // antes las categorías, ni de que el archivo original tenga esa columna.
        if (!idCat) {
          const rCat = await dispatch(createCategoria({ Nombre: catNombreOrig }));
          if (!rCat.error && rCat.payload?.Id_categoria) {
            idCat = rCat.payload.Id_categoria;
            catByName[catNombre] = idCat;
            if (catNombre !== SIN_CATEGORIA) categoriasCreadas++;
          } else {
            // Igual que en importInventarioReal: si la creación falló porque la categoría
            // YA existe (de una corrida anterior), se busca en el catálogo actual en vez
            // de dar por perdidos todos los repuestos siguientes de esa categoría.
            const idExistente = await _resolverCategoriaExistente(catNombreOrig, categoriasFrescasCache);
            if (idExistente) {
              idCat = idExistente;
              catByName[catNombre] = idCat;
              categoriasRecuperadas++;
            } else {
              motivoFallo = rCat.payload || 'No se pudo crear la categoría';
            }
          }
        }
        if (!nombre) { fail++; continue; } // fila sin ningún nombre reconocible: nada que reportar por nombre
        if (!idCat) { fail++; faltantes.push({ nombre, motivo: motivoFallo || 'Categoría no disponible' }); continue; }
        const r = await dispatch(createRepuesto({
          NombreRepuesto: nombre,
          Id_categoria: idCat,
          Stock: Number(fila.Stock ?? fila.stock ?? fila.Cantidad ?? fila.cantidad ?? 0) || 0,
          StockMinimo: Number(fila['Stock mínimo'] ?? fila.StockMinimo ?? 5) || 5,
          MargenPorcentaje: Number(fila['Margen %'] ?? fila.MargenPorcentaje ?? 50) || 50,
        }));
        if (r.error) { fail++; faltantes.push({ nombre, motivo: r.payload || 'Error al crear el repuesto' }); }
        else ok++;
      }
      setImportMsg({ ok, fail, categoriasCreadas, categoriasRecuperadas, fallosPorMotivo: _agruparPorMotivo(faltantes) });
      fetchPage();
      if (categoriasCreadas > 0) {
        api.get('/api/categoria-repuestos').then(r => setCategorias(r.data?.data || r.data || [])).catch(() => {});
      }
      setImportProgress(100);
      setImportOverlay('done');
      await new Promise((resolve) => setTimeout(resolve, 900));
    } catch (err) {
      console.error('Importar repuestos desde Excel:', err);
      setImportMsg({ ok: 0, fail: 0, error: `No se pudo leer el archivo: ${err?.message || 'verifica que sea un Excel válido.'}` });
    } finally {
      setImportando(false);
      setImportOverlay('idle');
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
      {importOverlay !== 'idle' && ReactDOM.createPortal(
        // Portal a document.body (mismo patrón que Modal.jsx): si se renderizara aquí
        // dentro de .page, quedaría "atrapado" como position:fixed relativo a .page en
        // vez del viewport -- .page tiene una animación de entrada (pageFadeIn, ver
        // page.css) con "animation: ... both", que dejaba pegado un transform de la
        // última keyframe (translateY(0)) incluso ya terminada la animación. Cualquier
        // transform (aunque sea el identity translateY(0)) convierte a ese ancestro en
        // el containing block de sus descendientes position:fixed -- por eso el overlay
        // no llegaba a cubrir ni el sidebar ni el resto del viewport (quedaba confinado
        // al alto/ancho de .page). Un portal a body evita depender de que ningún
        // ancestro futuro se quede sin transform.
        <div className="import-overlay" role="status" aria-live="polite">
          <div className="import-overlay__card">
            {importOverlay === 'done' ? (
              <>
                <MdCheckCircle className="import-overlay__check" size={56} />
                <p className="import-overlay__title">Importación completada</p>
              </>
            ) : (
              <>
                <p className="import-overlay__title">Importando repuestos...</p>
                <div className="import-overlay__bar-track">
                  <div className="import-overlay__bar-fill" style={{ width: `${importProgress}%` }} />
                </div>
                <p className="import-overlay__pct">{importProgress}%</p>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
      {importMsg && <ImportResumenPanel importMsg={importMsg} onClose={() => setImportMsg(null)} />}
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
            <SearchableSelect
              options={categorias.map(c => ({ value: String(c.Id_categoria), label: c.Nombre }))}
              value={formData.Id_categoria != null ? String(formData.Id_categoria) : ''}
              onChange={id => { handleChange({ target: { name: 'Id_categoria', value: id } }); handleBlur({ target: { name: 'Id_categoria' } }); }}
              placeholder="Seleccionar categoría..."
            />
            {fieldError('Id_categoria') && <p className="form-error">{fieldError('Id_categoria')}</p>}
          </div>
          <div className="form-group span-2">
            <label className="form-label">Stock mínimo</label>
            <input name="StockMinimo" type="number" min="0" className="form-control" value={formData.StockMinimo} onChange={handleChange} placeholder="5" />
          </div>
          <div className="form-group span-2">
            <label className="form-label">Margen de ganancia (%)</label>
            <input name="MargenPorcentaje" type="number" min="0" step="1" className={`form-control ${fieldError('MargenPorcentaje') ? 'is-error' : ''}`} value={formData.MargenPorcentaje} onChange={handleChange} onBlur={handleBlur} placeholder="50" />
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

