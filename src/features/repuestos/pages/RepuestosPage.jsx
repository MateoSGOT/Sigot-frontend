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
import Modal from '../../../shared/components/Modal/Modal.jsx';
import Table from '../../../shared/components/Table/Table.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import FilterDropdown from '../../../shared/components/FilterDropdown/FilterDropdown.jsx';
import { StatusBadge } from '../../../shared/components/Badge/Badge.jsx';
import { formatCurrency, todayLocalYMD } from '../../../shared/utils/helpers.js';
import * as V from '../../../shared/utils/validators.js';
import { useFormValidation } from '../../../shared/hooks/useFormValidation.js';
import api from '../../../shared/services/api.js';
// Se importa como `Motion` (mayuscula): la config de eslint del proyecto exime de
// no-unused-vars solo lo que empieza en mayuscula, y sin eslint-plugin-react la regla
// no reconoce el JSX con miembro (<Motion.div>) como un uso.
import { motion as Motion, AnimatePresence } from 'motion/react';
import { RESORTE } from '../../../shared/styles/movimiento.js';
import { MAQUETA_FILAS_REPUESTOS } from '../../../shared/dev/datosMaqueta.js';

/* La puerta se evalua AQUI, no se importa, y la diferencia no es de estilo.
   Importada desde datosMaqueta.js, MAQUETA_ACTIVA es una const de OTRO modulo:
   Vite sustituye import.meta.env.DEV por `false` dentro de ese modulo, pero no
   propaga el valor plegado a traves del limite del import, asi que el `if` de
   aca nunca se declaraba muerto y los datos de maqueta seguian referenciados.
   Resultado comprobado en dist/: un chunk datosMaqueta de 3,9 KB con nombres,
   placas y precios inventados, importado por esta pagina en PRODUCCION -- justo
   lo que el comentario del modulo decia que no podia pasar.
   Escrita en este archivo, las dos lecturas de import.meta.env se reemplazan por
   literales al compilar, la expresion se pliega a `false` y la rama (con sus
   referencias a los datos) desaparece junto con el chunk. */
const MAQUETA_ACTIVA = import.meta.env.DEV && import.meta.env.VITE_DEV_SKIP_AUTH === 'true';

/* ── Clases del modulo de inventario ───────────────────────────────────────
   Antes vivian en RepuestosPage.css. Se conservan los valores exactos (incluido
   el tracking de 0.3px de las insignias, que no cae en ningun token) para que la
   migracion no mueva nada en pantalla.

   Los colores salen de los pares *-soft / *-soft-on de variables.css, pensados
   justamente para un fondo tintado con su texto legible encima. */
const CELDA_STOCK = 'inline-flex items-center gap-xs font-semibold';
/* whitespace-nowrap: la columna Stock es estrecha y "STOCK BAJO" se partia en
   dos lineas dentro de la pildora. El CSS viejo tampoco lo evitaba; se ve al
   mirar la tabla con datos reales. */
const BADGE_STOCK = 'whitespace-nowrap rounded-[4px] px-[5px] py-px text-[10px] font-bold tracking-[0.3px]';
const BADGE_AGOTADO = `${BADGE_STOCK} bg-danger-soft text-danger-soft-on`;
const BADGE_BAJO = `${BADGE_STOCK} bg-warning-soft text-warning-soft-on`;

/* Banner de reabastecimiento: critico cuando algun repuesto esta en cero. */
/* flex-wrap: en el ancho de un celular el texto ocupa dos lineas y el boton
   "Ver solo stock bajo" se salia del banner, cortado por la derecha. Venia asi
   del CSS anterior (flex sin wrap + margin-left:auto); solo se ve con datos
   cargados y a 390px. Al permitir el salto, el boton baja a su propia linea y
   se mantiene alineado a la derecha. */
const BANNER = 'mb-md flex flex-wrap items-center gap-sm rounded-[8px] px-lg py-md text-body font-medium';
const BANNER_CRITICO = `${BANNER} border border-danger-soft-border bg-danger-soft text-danger-soft-on`;
const BANNER_BAJO = `${BANNER} border border-warning-soft-border bg-warning-soft text-warning-soft-on`;

/* Panel de resultados del import de Excel: tres niveles de severidad. */
const RESUMEN = 'mx-[2rem] my-lg flex flex-col gap-[0.6rem] rounded-sm border border-border bg-surface px-lg py-[0.85rem] text-body';
const NIVEL = 'flex flex-col gap-[0.3rem] rounded-[8px] px-md py-[0.6rem] [&_p]:m-0 [&_span]:m-0';
const NIVEL_OK = `${NIVEL} border border-primary-soft-border bg-primary-soft text-primary-soft-on`;
const NIVEL_AVISO = `${NIVEL} border border-warning-soft-border bg-warning-soft text-warning-soft-on`;
const NIVEL_ERROR = `${NIVEL} border border-danger-soft-border bg-danger-soft text-danger-soft-on`;
const DETALLE = '[&>summary]:cursor-pointer [&>summary]:font-semibold [&_ul]:mt-xs [&_ul]:max-h-[220px] [&_ul]:overflow-y-auto [&_ul]:pl-lg';

// El repuesto es una ficha de catálogo: Stock y Costo (Precio) se llenan al comprar, no al crear.
// El margen ya no tiene piso fijo (antes 50%) -- el taller puede vender con un margen
// más bajo si lo necesita (ej. competir en precio); el precio de venta se calcula
// igual (costo × margen × IVA).
/* OJO con MargenGanancia: en el FORMULARIO es un porcentaje entero (50) y en
   la API es un factor decimal (0.5). La conversion ocurre en dos sitios y solo
   dos: openEdit al cargar (factor -> %) y handleSubmit al enviar (% -> factor).

   El defecto del formulario es 50 por pedido del taller, y conviene saber que
   NO coincide con el margen real del inventario importado, que es 0.635 (63.5
   %) en las 415 fichas que entraron del Excel. Un repuesto creado a mano
   arranca entonces con un margen distinto al de sus vecinos: es intencional,
   no un descuido. */
const EMPTY = { NombreRepuesto: '', Codigo: '', StockMinimo: '5', MargenGanancia: '50', _costo: 0, _iva: 19, _precioVenta: null };
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

/* Primer alias con contenido REAL. Hace falta porque sheet_to_json corre con
   defval:'': una columna presente pero vacia en esa fila llega como cadena
   vacia, que para `??` es un valor definido y corta la cadena de respaldo. */
const _primerValor = (fila, alias) => {
  for (const k of alias) {
    const v = fila[k];
    if (v != null && String(v).trim() !== '') return v;
  }
  return null;
};

/* El margen se GUARDA como factor (0.635) porque es lo que divide en la
   formula, pero el taller lo lee como porcentaje. Se pinta multiplicado por
   100 con un decimal y sin el .0 sobrante: 0.635 -> "63.5%", 0.5 -> "50%".
   El redondeo es necesario, no cosmetico: la mayoria de los factores no son
   exactos en binario y un toFixed crudo saca cosas como "63.5%" junto a
   "80.0%". No toca el valor almacenado ni lo que se envia a la API. */
const _margenPorcentaje = (factor) => {
  const f = Number(factor);
  if (!Number.isFinite(f)) return '—';
  const pct = _factorAPorcentaje(f);
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
};

/* Las DOS conversiones del formulario, en un solo lugar y en un solo sentido
   cada una. El input habla en porcentaje entero (50) y la API en factor
   decimal (0.5); tener la multiplicacion repartida por el componente es como
   se cuela un margen 100 veces mas grande.

   El redondeo del factor -> porcentaje no es cosmetico: 0.635*100 da 63.5
   limpio, pero muchos factores no son exactos en binario y salen con cola
   (0.07*100 = 7.000000000000001), que en un input type=number se ve. */
const _factorAPorcentaje = (factor) => Math.round(Number(factor) * 1000) / 10;
const _porcentajeAFactor = (pct) => Number(pct) / 100;
// Pausa entre filas del import de Excel: con hasta 2 solicitudes por fila (categoría +
// repuesto) y archivos reales de cientas de filas, sin ninguna pausa el import dispara
// cientos de solicitudes seguidas en pocos segundos -- mala práctica de todas formas,
// con o sin límite en el servidor (ver globalLimiter en app.js, API).
const PAUSA_ENTRE_FILAS_MS = 60;

const RULES = {
  NombreRepuesto: (v) => V.nombre(v, 3, 120),
  Codigo: (v) => {
    const t = String(v ?? '').trim();
    if (!t) return 'El código de inventario es obligatorio.';
    if (t.length > 40) return 'El código no puede superar los 40 caracteres.';
    return '';
  },
  // En PORCENTAJE, que es lo que se teclea. El limite de 100 es el mismo que el
  // de la API expresado en esta unidad (factor <= 1): por encima de 100 % se
  // venderia por debajo del costo.
  MargenGanancia: (v) => {
    if (v == null || String(v).trim() === '') return ''; // opcional; queda en su default
    const n = Number(v);
    if (Number.isNaN(n)) return 'El margen debe ser un número.';
    if (n <= 0) return 'El margen debe ser mayor que 0 %.';
    if (n > 100) return 'El margen no puede pasar del 100 %: sería vender por debajo del costo.';
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
      <div className={`${RESUMEN} flex-row items-center gap-sm border-danger-soft-border bg-danger-soft text-danger-soft-on`}>
        <span>{importMsg.error}</span>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>Cerrar</button>
      </div>
    );
  }

  const rr = importMsg.resumenReal;
  const prefijosOrdenados = rr ? Object.entries(rr.porPrefijo ?? {}).sort((a, b) => b[1] - a[1]) : [];
  const portaCount = 0;
  const motivos = Object.entries(importMsg.fallosPorMotivo || {});
  const hayAdvertencias = !!rr && (rr.omitidosSinDescripcion > 0 || rr.sinLote > 0 || rr.fallbackSinFecha?.length > 0 || portaCount > 10);
  // Tope defensivo de nombres mostrados por motivo (un import real puede tener cientos de
  // filas repitiendo el mismo motivo) -- el conteo del <summary> siempre es el real.
  const TOPE_NOMBRES = 60;

  return (
    <div className={RESUMEN}>
      <div className="flex items-center gap-sm">
        <span className="font-bold">Resultado de la importación</span>
        <button className="btn btn--ghost btn--sm ml-auto" onClick={onClose}>Cerrar</button>
      </div>

      <div className={NIVEL_OK}>
        <span>✓ {importMsg.ok} repuesto(s) creado(s).</span>
        {importMsg.sinCodigo > 0 && <span>{importMsg.sinCodigo} fila(s) sin código de inventario: omitidas.</span>}
      </div>

      {hayAdvertencias && (
        <div className={NIVEL_AVISO}>
          {rr.omitidosSinDescripcion > 0 && (
            <p>⚠ {rr.omitidosSinDescripcion} código(s) reservado(s) en el archivo sin Descripción -- NO se importaron (no son repuestos reales todavía, hay que completarlos en el Excel primero): {rr.omitidosCodigos.slice(0, 10).join(', ')}{rr.omitidosCodigos.length > 10 ? `… y ${rr.omitidosCodigos.length - 10} más` : ''}.</p>
          )}
          {rr.sinLote > 0 && <p>⚠ {rr.sinLote} repuesto(s) sin ningún lote asociado (Precio/Margen quedaron en los valores por defecto).</p>}
          {rr.fallbackSinFecha?.length > 0 && (
            <p>⚠ {rr.fallbackSinFecha.length} código(s) con más de un lote donde no se pudo determinar cuál es el más reciente por fecha (se usó el último que aparece en la hoja Lotes): {rr.fallbackSinFecha.slice(0, 10).join(', ')}{rr.fallbackSinFecha.length > 10 ? '…' : ''}.</p>
          )}
          {portaCount > 10 && (
            <p className="font-bold">⚠ La categoría "Porta" agrupó {portaCount} repuestos distintos -- revisa si conviene dividirla en categorías más específicas desde el módulo de Categorías.</p>
          )}
        </div>
      )}

      {rr && (
        <details className={DETALLE}>
          <summary>Ver {prefijosOrdenados.length} prefijo(s) de código y cuántos repuestos tiene cada uno</summary>
          <ul>
            {prefijosOrdenados.map(([nombre, cantidad]) => <li key={nombre}>{nombre}: {cantidad}</li>)}
          </ul>
        </details>
      )}

      {importMsg.fail > 0 && (
        <div className={NIVEL_ERROR}>
          <p className="font-bold">✕ {importMsg.fail} repuesto(s) no se pudieron importar:</p>
          {motivos.map(([motivo, nombres]) => (
            <details key={motivo} className={`${DETALLE} [&>summary]:font-medium`}>
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
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('todos');
  // Siguiente codigo libre que sugiere la API al abrir el formulario de alta.
  const [codigoSugerido, setCodigoSugerido] = useState('');
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
      if (stockBajoFilter) params.set('soloBajo', 'true');
      const r = await api.get(`/api/repuestos?${params.toString()}`);
      // El backend devuelve NombreRepuesto; la columna de la tabla lee `Nombre`
      // (igual que exportarExcel y openEdit). Sin este mapeo el nombre sale en blanco.
      // Estado viene como booleano crudo de Postgres (paginación server-side, sin pasar por
      // el norm() del slice) -- sin este mapeo el ToggleSwitch (que compara === 1) siempre
      // se ve apagado, sin importar el estado real.
      setRows((r.data?.data || []).map(x => ({ ...x, Nombre: x.NombreRepuesto || x.Nombre || '', Estado: x.Estado === true ? 1 : x.Estado === false ? 0 : x.Estado })));
      setTotal(r.data?.total ?? 0);
    } catch {
      // Sin sesion las peticiones reciben 401 y la tabla queda vacia, asi que no
      // hay forma de revisar la celda de stock, las insignias ni el banner --
      // que es justo lo que esta pantalla tiene que mostrar bien. Solo en local
      // y detras de la misma puerta doble que el resto de la maqueta.
      if (MAQUETA_ACTIVA) { setRows(MAQUETA_FILAS_REPUESTOS); setTotal(MAQUETA_FILAS_REPUESTOS.length); }
      else { setRows([]); setTotal(0); }
    }
    finally { setListLoading(false); }
  }, [page, pageSize, search, statusFilter, stockBajoFilter]);

  const fetchStockBajo = useCallback(async () => {
    try { const r = await api.get('/api/repuestos/stock-bajo'); setStockBajoItems(r.data?.data || r.data || []); }
    catch {
      if (MAQUETA_ACTIVA) setStockBajoItems(MAQUETA_FILAS_REPUESTOS.filter(x => x.Stock <= x.StockMinimo));
    }
  }, []);

  const esSuperadmin = useSelector(s => s.auth.empleado?.EsSuperAdmin === true);
  const del = useBorradoReal(repuestosService, { entidadLabel: 'repuesto', onDeleted: () => { fetchPage(); fetchStockBajo(); } });

  useEffect(() => {
    fetchStockBajo();
  }, [fetchStockBajo]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  // Al cambiar búsqueda/filtro → reiniciar a la página 1 (y refetch por dependencias).
  const onSearch    = (v) => { setSearch(v); setPage(1); };
  const onStatus    = (v) => { setStatusFilter(v); setPage(1); };
  const onPageSize  = (v) => { setPageSize(v); setPage(1); };
  const onToggleBajo = () => { setStockBajoFilter(v => !v); setPage(1); };
  const refrescar = () => { fetchPage(); fetchStockBajo(); };

  const itemsConStockBajo = stockBajoItems;

  const exportarExcel = async () => {
    try {
      const res = await api.get('/api/repuestos?limit=9999');
      const data = res.data?.data || res.data || rows;

      const exportRows = data.map((r, i) => ({
        '#': i + 1,
        Nombre: r.NombreRepuesto || r.Nombre || '',
        Código: r.Codigo || '—',
        Stock: r.Stock ?? 0,
        Costo: Number(r.Precio ?? 0),
        Margen: Number(r.MargenGanancia ?? 0.635),
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

  // --- Importación del INVENTARIO REAL (formato multi-hoja REPUESTOS/Lotes/Entradas) ---
  // Se detecta por la presencia de una hoja "REPUESTOS" y una hoja "Lotes" en el mismo
  // libro; si no calzan esos nombres, se usa el importador genérico de una sola hoja
  // de siempre (más abajo), sin ningún cambio de comportamiento.
  //
  // LA "s" DE /^repuestos?$/i NO ES COSMETICA. El detector pedia la hoja en
  // SINGULAR y el archivo del taller la llama "REPUESTOS": no casaba, el libro
  // se iba al importador generico, y ese lee la PRIMERA hoja -- que trae
  // Codigo, Descripcion, Ubicacion, Und medida y Stock, y NINGUNA columna de
  // dinero. Los costos viven en la hoja Lotes ("Prc con dsc"), que solo este
  // camino cruza. De ahi el sintoma exacto: codigos y stock perfectos, Costo y
  // Precio de venta en "—". Ningun alias de costo podia arreglarlo, porque en
  // esa hoja no hay costo que leer.
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
    const repuestoRows = _parsearHoja(wb, _buscarHoja(wb, /^repuestos?$/i));
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

    /* Ya no se derivan categorias de la descripcion: el CODIGO del propio archivo
       es ahora el identificador del repuesto. Eso elimina de un golpe el bloque
       que creaba categorias por la primera palabra, el respaldo que las
       recuperaba cuando la creacion fallaba y el cache de categorias frescas:
       tres mecanismos que existian solo para sostener una dimension que el
       archivo del taller nunca tuvo. */
    let ok = 0, fail = 0, omitidosSinDescripcion = 0, sinLote = 0;
    const porPrefijo = {};
    const faltantes = []; // { nombre, motivo }
    const omitidosCodigos = []; // códigos con fila reservada pero sin Descripción

    for (let i = 0; i < repuestoRows.length; i++) {
      if (i > 0) await _sleep(PAUSA_ENTRE_FILAS_MS);
      const fila = repuestoRows[i];
      setImportProgress(Math.round(((i + 1) / repuestoRows.length) * 100));
      const codigo = String(fila.Codigo || '').trim();
      // Filas de relleno del archivo real (sin código ni ningún otro dato): se descartan.
      if (!codigo) continue;
      const descripcion = String(fila.Descripcion || '').trim();
      // Código con Descripción vacía: NO es un repuesto con dato incompleto -- es un
      // casillero reservado en la plantilla del taller que todavía no se llenó. Se omite
      // en vez de crear un repuesto fantasma con el código como nombre. El backend
      // rechaza esa misma forma por su cuenta (ver repuesto.model.js::_assertNombreUtil),
      // así que ahora hay dos barreras y no una.
      if (!descripcion) { omitidosSinDescripcion++; omitidosCodigos.push(codigo); continue; }
      const nombre = descripcion;

      const lote = elegirLote(codigo);
      const payload = {
        Codigo: codigo,
        NombreRepuesto: nombre,
        /* ?? y no ||: un stock de 0 es un dato REAL (repuesto agotado). Con `||`
           un 0 legítimo caía al valor por defecto y el inventario entraba mal. */
        Stock: Number(fila.Stock ?? 0),
      };
      if (lote) {
        /* _primerValor y no Number(lote['Prc con dsc']) a secas: con defval:'' una
           celda vacia da Number('') === 0, y `!isNaN(0)` es cierto, asi que se
           enviaba un COSTO 0 como si fuera un dato. El backend lo acepta, no
           calcula PrecioVenta (requiere costo > 0) y las dos columnas quedan en
           "—" aunque el codigo y el stock hayan entrado bien. Mismo sintoma que
           el del importador de hoja unica, por otro camino. */
        const costo  = Number(_primerValor(lote, ['Prc con dsc', 'Costo', 'Precio Unitario', 'Precio unitario', 'Precio']) ?? NaN);
        /* SIN multiplicar por 100. El archivo del taller ya guarda el margen como
           FACTOR decimal (0.635) y antes se convertía a porcentaje porque el
           backend lo esperaba así. Ahora el backend usa el factor tal cual en
           costo/margen, de modo que la conversión sobra -- y aplicarla daría un
           precio de venta 100 veces menor. */
        const margen = Number(_primerValor(lote, ['Margen de ganancia', 'Margen', 'MargenGanancia']) ?? NaN);
        const precioVentaReal = Number(_primerValor(lote, ['Precio de venta', 'PrecioVenta', 'Precio venta']) ?? NaN);
        // costo > 0 y no solo !isNaN: un 0 aqui no es un costo, es una celda sin llenar.
        if (Number.isFinite(costo) && costo > 0) payload.Precio = costo;
        if (Number.isFinite(margen) && margen > 0) payload.MargenGanancia = margen;
        // PrecioVenta se importa TAL CUAL (punto de partida real del inventario ya
        // comprado); la SIGUIENTE compra lo recalcula con la fórmula estándar.
        if (Number.isFinite(precioVentaReal) && precioVentaReal > 0) payload.PrecioVenta = precioVentaReal;
      } else {
        sinLote++;
      }

      const r = await dispatch(createRepuesto(payload));
      if (r.error) { fail++; faltantes.push({ nombre, motivo: r.payload || 'Error al crear el repuesto' }); }
      else {
        ok++;
        const prefijo = codigo.split('-')[0] || 'Sin prefijo';
        porPrefijo[prefijo] = (porPrefijo[prefijo] || 0) + 1;
      }
    }

    setImportMsg({
      ok, fail, fallosPorMotivo: _agruparPorMotivo(faltantes),
      resumenReal: { omitidosSinDescripcion, omitidosCodigos, sinLote, porPrefijo, fallbackSinFecha },
    });
    fetchPage();
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
      const esFormatoReal = _buscarHoja(wb, /^repuestos?$/i) && _buscarHoja(wb, /^lotes$/i);
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

      let ok = 0, fail = 0, sinCodigo = 0;
      const faltantes = []; // { nombre, motivo }
      for (let i = 0; i < filas.length; i++) {
        if (i > 0) await _sleep(PAUSA_ENTRE_FILAS_MS);
        const fila = filas[i];
        setImportProgress(Math.round(((i + 1) / filas.length) * 100));

        /* El CODIGO es ahora obligatorio y unico. Sin el no hay repuesto que
           crear, asi que la fila se omite en vez de inventarle uno: un codigo
           autogenerado aqui chocaria con la numeracion real del taller. */
        const codigo = String(fila.Codigo ?? fila.codigo ?? fila['Código'] ?? '').trim();
        if (!codigo) { sinCodigo++; continue; }

        /* Con ?? una celda vacia ("") ya cuenta como definida y corta la cadena de
           respaldo, por eso se recorre una lista y se toma el primer candidato con
           contenido real. OJO: el codigo YA NO esta en esta lista -- usarlo como
           nombre es justo lo que generaba repuestos fantasma, y el backend ahora lo
           rechaza (ver repuesto.model.js::_assertNombreUtil). */
        const nombreCandidatos = [fila.Nombre, fila.NombreRepuesto, fila.nombre, fila.Descripcion, fila.descripcion];
        const nombre = String(nombreCandidatos.find(v => v != null && String(v).trim() !== '') ?? '').trim();
        if (!nombre) { fail++; faltantes.push({ nombre: codigo, motivo: 'La fila no trae descripción: se necesita para no crear un repuesto fantasma' }); continue; }

        /* ?? en lugar de ||, y no es cosmetico: con `|| 5` un stock minimo de 0 se
           convertia en 5, y con `|| 50` un margen de 0 pasaba a 50. El operador de
           fusion nula solo sustituye null/undefined, de modo que los ceros reales
           del Excel llegan como ceros. */
        const stock       = Number(fila.Stock ?? fila.stock ?? fila.Cantidad ?? fila.cantidad ?? fila.Existencia ?? fila.existencia ?? 0);
        const stockMinimo = Number(fila['Stock mínimo'] ?? fila.StockMinimo ?? 5);
        const margen      = Number(fila['Margen de ganancia'] ?? fila.MargenGanancia ?? fila['Margen'] ?? 0.635);

        /* EL COSTO: esta lectura NO existia, y es la causa exacta de que Costo y
           Precio de venta entraran vacios mientras Codigo y Stock entraban
           perfectos -- este importador leia codigo, nombre, stock, minimo y
           margen, y de precios no mandaba nada. El backend recibe Precio
           ausente, lo deja en 0, y con costo 0 no calcula PrecioVenta (lo deja
           en null): las dos celdas se pintan "—".

           Se usa _primerValor y NO la cadena `??` directa: sheet_to_json corre
           con defval:'', asi que una columna que EXISTE pero viene vacia en esa
           fila llega como '' -- un valor definido, que corta la cadena de
           fusion nula y entrega Number('') === 0. Es la misma trampa que ya
           obligo a recorrer candidatos para el nombre unas lineas arriba. */
        const costo = Number(_primerValor(fila, ['Prc con dsc', 'Costo', 'Precio Unitario', 'Precio unitario', 'Precio', 'costo']) ?? 0);
        /* El precio de venta del archivo se respeta TAL CUAL cuando viene, igual
           que en el importador multi-hoja: es el punto de partida real del
           inventario ya comprado. Si no viene, el backend lo calcula con la
           formula (costo/margen + costo*0.19). */
        const precioVentaArchivo = Number(_primerValor(fila, ['Precio de venta', 'PrecioVenta', 'Precio venta']) ?? NaN);

        const payload = {
          Codigo: codigo,
          NombreRepuesto: nombre,
          Stock: Number.isFinite(stock) ? stock : 0,
          StockMinimo: Number.isFinite(stockMinimo) ? stockMinimo : 5,
        };
        if (Number.isFinite(costo) && costo > 0) payload.Precio = costo;
        if (Number.isFinite(precioVentaArchivo) && precioVentaArchivo > 0) payload.PrecioVenta = precioVentaArchivo;
        // El margen es un FACTOR (0.635). Solo se envia si es valido; si no, el
        // backend aplica su propio defecto.
        if (Number.isFinite(margen) && margen > 0 && margen <= 1) payload.MargenGanancia = margen;

        const r = await dispatch(createRepuesto(payload));
        if (r.error) { fail++; faltantes.push({ nombre, motivo: r.payload || 'Error al crear el repuesto' }); }
        else ok++;
      }
      setImportMsg({ ok, fail, sinCodigo, fallosPorMotivo: _agruparPorMotivo(faltantes) });
      fetchPage();
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

  const openCreate = () => {
    setFormData(EMPTY); setEditingId(null); setFormError(''); reset(); setShowForm(true);
    /* Se pide al ABRIR, no al montar la pagina: asi refleja el inventario del
       momento y no un valor viejo de cuando se cargo la vista. Si falla, el campo
       queda vacio y se escribe a mano -- la sugerencia es una comodidad, no un
       requisito. */
    api.get('/api/repuestos/siguiente-codigo')
      .then(r => setCodigoSugerido(r.data?.data?.codigo || ''))
      .catch(() => setCodigoSugerido(''));
  };
  const openEdit = (item) => {
    setFormData({
      NombreRepuesto: item.NombreRepuesto || item.Nombre || '',
      StockMinimo: String(item.StockMinimo ?? 5),
      Codigo: String(item.Codigo ?? ''),
      MargenGanancia: String(_factorAPorcentaje(item.MargenGanancia ?? 0.5)),
      _costo: Number(item.Precio ?? 0),
      _iva: Number(item.IvaPorcentaje ?? 19),
      _precioVenta: item.PrecioVenta ?? null,
    });
    setEditingId(item.Id_Repuesto); setFormError(''); reset(); setShowForm(true);
  };

  /* Previsualizacion del precio de venta al cambiar el margen. La fuente de
     verdad sigue siendo la API; esto solo evita guardar a ciegas.

     Estaba calculando con la formula ANTERIOR -- costo*(1+m/100)*(1+iva/100),
     con el margen multiplicando y el IVA sobre el total -- y con un piso de
     m < 50 que ya no existe. Mostraba un numero que no era el que la API iba a
     guardar: para costo 16008 y margen 50 %, 28574 en pantalla contra 31059
     reales. Ahora es la misma formula del servidor. */
  const previewPrecioVenta = () => {
    const costo = Number(formData._costo ?? 0);
    const pct   = Number(formData.MargenGanancia);
    if (!costo || !Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
    const margen = _porcentajeAFactor(pct);
    return Math.round(costo / margen + costo * 0.19);
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
      Codigo: String(formData.Codigo).trim(),
      /* % -> factor. La API espera el factor decimal (0.5), el input muestra
         el porcentaje (50). Si este /100 se cae, el validador de Joi rechaza el
         50 con "no puede ser mayor que 1", que es la red de seguridad. */
      MargenGanancia: _porcentajeAFactor(formData.MargenGanancia ?? 50),
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
    { key: 'Nombre', label: 'Nombre', render: v => <span className="font-semibold">{v}</span> },
    { key: 'Codigo', label: 'Código', render: v => <span className="font-mono text-small">{v}</span> },
    {
      key: 'Stock', label: 'Stock', render: (v, row) => {
        const min = Number(row.StockMinimo ?? 5);
        const stock = Number(v);
        const agotado = stock === 0;
        const bajo = stock <= min;
        return (
          <span className={`${CELDA_STOCK} ${agotado ? 'text-danger-soft-on' : bajo ? 'text-warning-soft-on' : ''}`}>
            {bajo && <MdWarning size={14} aria-hidden="true" />}
            {v}
            {agotado && <span className={BADGE_AGOTADO}>AGOTADO</span>}
            {!agotado && bajo && <span className={BADGE_BAJO}>STOCK BAJO</span>}
          </span>
        );
      }
    },
    { key: 'StockMinimo', label: 'Stock mín.', render: v => v ?? 5 },
    { key: 'Precio', label: 'Costo', render: v => (v != null && Number(v) > 0 ? formatCurrency(v) : '—') },
    { key: 'MargenGanancia', label: 'Margen', render: v => _margenPorcentaje(v ?? 0.635) },
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
        <div className="page__actions">
          <input ref={fileImportRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
          <button className="btn btn--outline" onClick={() => fileImportRef.current?.click()} disabled={!puedeCrear || importando} title="Importar repuestos desde Excel (columnas: Nombre, Categoría)"><MdUploadFile size={17} />{importando ? 'Importando...' : 'Importar Excel'}</button>
          <button className="btn btn--outline text-primary border-primary" onClick={exportarExcel}><MdTableChart size={17} />Exportar Excel</button>
          <button className="btn btn--primary" onClick={openCreate} disabled={!puedeCrear}><MdAdd size={18} />Nuevo repuesto</button>
        </div>
      </div>
      {ReactDOM.createPortal(
        <AnimatePresence>{importOverlay !== 'idle' && (
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
        <Motion.div
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-[rgb(10_10_11_/_0.45)] backdrop-blur-[2px]"
          role="status" aria-live="polite"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <Motion.div
            className="flex max-w-[90vw] min-w-[280px] flex-col items-center gap-[0.9rem] rounded-[14px] bg-surface px-[2.5rem] py-2xl shadow-[0_20px_50px_rgb(0_0_0_/_0.25)]"
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
            transition={RESORTE}
          >
            {importOverlay === 'done' ? (
              <>
                {/* El check entraba con un cubic-bezier de rebote escrito a mano;
                    ahora lo da el mismo muelle compartido que el resto de la app. */}
                <Motion.span className="text-primary"
                  initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
                  transition={RESORTE}
                >
                  <MdCheckCircle size={56} />
                </Motion.span>
                <p className="m-0 text-center text-h3 font-semibold text-text">Importación completada</p>
              </>
            ) : (
              <>
                <p className="m-0 text-center text-h3 font-semibold text-text">Importando repuestos...</p>
                <div className="h-sm w-[220px] overflow-hidden rounded-full bg-border">
                  <Motion.div
                    className="h-full rounded-full bg-linear-to-r from-primary to-primary-500"
                    animate={{ width: `${importProgress}%` }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  />
                </div>
                <p className="m-0 text-h2 font-bold text-primary tabular-nums">{importProgress}%</p>
              </>
            )}
          </Motion.div>
        </Motion.div>
        )}</AnimatePresence>,
        document.body
      )}
      {importMsg && <ImportResumenPanel importMsg={importMsg} onClose={() => setImportMsg(null)} />}
      {itemsConStockBajo.length > 0 && (
        <div className={itemsConStockBajo.some(i => i.Stock === 0) ? BANNER_CRITICO : BANNER_BAJO}>
          <MdWarning size={18} />
          <span><strong>{itemsConStockBajo.length}</strong> repuesto(s) necesitan reabastecimiento</span>
          <button className="btn btn--sm btn--outline ml-auto" onClick={onToggleBajo}>
            {stockBajoFilter ? 'Ver todos' : 'Ver solo stock bajo'}
          </button>
        </div>
      )}
      <div className="card">
        <div className="card__header">
          <SearchBar
            value={search}
            onChange={onSearch}
            placeholder="Buscar por nombre o código..."
            filterSlot={
              <>
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
          <div className="detail-item"><span className="detail-label">Código</span><span className="detail-value font-mono">{detailItem.Codigo}</span></div>
          <div className="detail-item"><span className="detail-label">Stock</span><span className="detail-value">{detailItem.Stock}</span></div>
          <div className="detail-item"><span className="detail-label">Costo</span><span className="detail-value">{detailItem.Precio != null && Number(detailItem.Precio) > 0 ? formatCurrency(detailItem.Precio) : '—'}</span></div>
          <div className="detail-item"><span className="detail-label">Margen</span><span className="detail-value">{_margenPorcentaje(detailItem.MargenGanancia ?? 0.635)}</span></div>
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
            <label className="form-label">Código de inventario <span className="required">*</span></label>
            <div className="flex items-center gap-sm">
              <input
                name="Codigo"
                className={`form-control font-mono ${fieldError('Codigo') ? 'is-error' : ''}`}
                value={formData.Codigo}
                onChange={handleChange}
                onBlur={handleBlur}
                maxLength={40}
                placeholder={codigoSugerido || 'JC-1'}
                autoComplete="off"
              />
              {/* Sugerencia, no imposicion: rellena el siguiente libre de la serie
                  (JC-416 si el inventario llega a JC-415) y se puede sobrescribir.
                  Es una sugerencia y no una reserva -- si otra persona crea el mismo
                  codigo antes, el indice unico de la base lo rechaza. */}
              {!editingId && codigoSugerido && (
                <button
                  type="button"
                  className="btn btn--outline btn--sm whitespace-nowrap"
                  onClick={() => { handleChange({ target: { name: 'Codigo', value: codigoSugerido } }); handleBlur({ target: { name: 'Codigo' } }); }}
                >
                  Usar {codigoSugerido}
                </button>
              )}
            </div>
            {fieldError('Codigo') && <p className="form-error">{fieldError('Codigo')}</p>}
          </div>
          <div className="form-group span-2">
            <label className="form-label">Stock mínimo</label>
            <input name="StockMinimo" type="number" min="0" className="form-control" value={formData.StockMinimo} onChange={handleChange} placeholder="5" />
          </div>
          <div className="form-group span-2">
            <label className="form-label">Margen de ganancia (%)</label>
            {/* PORCENTAJE entero, como lo lee el taller. El % va dentro del campo
                con padding a la derecha para el texto, no como sufijo suelto: asi
                la unidad no se puede perder de vista al teclear. */}
            <div className="relative">
              <input name="MargenGanancia" type="number" min="1" max="100" step="1" inputMode="numeric" className={`form-control pr-2xl ${fieldError('MargenGanancia') ? 'is-error' : ''}`} value={formData.MargenGanancia} onChange={handleChange} onBlur={handleBlur} placeholder="50" />
              <span className="pointer-events-none absolute right-md top-1/2 -translate-y-1/2 text-body font-semibold text-text-muted">%</span>
            </div>
            {fieldError('MargenGanancia') && <p className="form-error">{fieldError('MargenGanancia')}</p>}
            <p className="form-hint">Porcentaje entre 1 y 100 (ej. 50). El precio de venta se calcula solo.</p>
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

