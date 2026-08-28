import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchDashboard } from '../slices/dashboardSlice.js';
import { dashboardService } from '../services/dashboardService.js';
import { formatCurrency } from '../../../shared/utils/helpers.js';
import {
  MdShoppingCart, MdMiscellaneousServices, MdPeople,
  MdPayments, MdReceiptLong, MdRefresh, MdWarning, MdBuild,
} from 'react-icons/md';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Area, AreaChart,
} from 'recharts';
import EmptyState from '../../../shared/components/EmptyState/EmptyState.jsx';
import Skeleton from '../../../shared/components/Skeleton/Skeleton.jsx';
import CountUp from '../../../shared/components/CountUp/CountUp.jsx';
import SearchBar from '../../../shared/components/SearchBar/SearchBar.jsx';
import { filterItems } from '../../../shared/utils/helpers.js';
import './DashboardPage.css';

const PIE_COLORS = ['#3a6b9e', '#8b2e2e', '#2d5a2d', '#8a7240', '#5c6b8a', '#7a4a6a', '#4a6b5c'];
const CHART_STYLE = {
  tooltip: {
    contentStyle: { background: '#ffffff', border: '1px solid rgba(0,0,0,0.10)', borderRadius: '8px', color: '#111111', fontSize: '0.8125rem', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' },
    labelStyle: { color: '#6b7280' },
    cursor: { fill: 'rgba(0,0,0,0.03)' },
  },
  grid: { strokeDasharray: '3 3', stroke: 'rgba(0,0,0,0.07)' },
  tick: { fontSize: 12, fill: '#9ca3af' },
};

const RANGOS = [
  { key: 'hoy',    label: 'Hoy' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes',    label: 'Este mes' },
  { key: 'anio',   label: 'Este año' },
  { key: 'custom', label: 'Personalizado' },
];

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function computeRango(preset, cDesde, cHasta) {
  const hoy = new Date();
  if (preset === 'hoy')    return { desde: fmt(hoy), hasta: fmt(hoy), agrupacion: 'dia' };
  if (preset === 'semana') { const d = new Date(hoy); d.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7)); return { desde: fmt(d), hasta: fmt(hoy), agrupacion: 'dia' }; }
  if (preset === 'mes')    { const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1); return { desde: fmt(d), hasta: fmt(hoy), agrupacion: 'dia' }; }
  if (preset === 'anio')   { const d = new Date(hoy.getFullYear(), 0, 1); return { desde: fmt(d), hasta: fmt(hoy), agrupacion: 'mes' }; }
  // custom
  const desde = cDesde || fmt(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const hasta = cHasta || fmt(hoy);
  const dias = (new Date(hasta) - new Date(desde)) / 86400000;
  return { desde, hasta, agrupacion: dias > 62 ? 'mes' : 'dia' };
}

// 'YYYY-MM-DD' -> etiqueta corta según agrupación. Defensivo: si el backend
// devuelve un periodo nulo/no-string no debe romper toda la pantalla.
const etiquetaPeriodo = (ymd, agrupacion) => {
  const [y, m, d] = String(ymd ?? '').split('-');
  if (!y || !m) return String(ymd ?? '');
  if (agrupacion === 'month' || agrupacion === 'mes')    return `${MESES[Number(m) - 1] ?? m} ${y}`;
  if (agrupacion === 'week'  || agrupacion === 'semana') return `Sem ${d}/${m}`;
  return `${d}/${m}`;
};

function StatCard({ icon: Icon, label, value, format = (n) => Math.round(n).toLocaleString('es-CO'), sub, color = 'green', loading }) {
  return (
    <div className={`stat-card stat-card--${color}`}>
      <div className="stat-card__icon-wrap"><Icon size={24} /></div>
      <div className="stat-card__body">
        <span className="stat-card__label">{label}</span>
        <span className="stat-card__value">
          <CountUp value={value} loading={loading} format={format} skeleton={<Skeleton width={90} height={22} />} />
        </span>
        {sub && <span className="stat-card__sub">{sub}</span>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { repuestos } = useSelector((s) => s.dashboard);

  const [preset, setPreset] = useState('mes');
  const [cDesde, setCDesde] = useState('');
  const [cHasta, setCHasta] = useState('');
  const rango = useMemo(() => computeRango(preset, cDesde, cHasta), [preset, cDesde, cHasta]);

  const [rep, setRep] = useState({ resumen: null, ingresos: null, topServicios: [], topRepuestos: [], productividad: [] });
  const [loading, setLoading] = useState(true);
  const [buscarMecanico, setBuscarMecanico] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);   // "Actualizar" fuerza un re-fetch

  useEffect(() => { dispatch(fetchDashboard()); }, [dispatch, refreshKey]);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    // computeRango ya entrega la agrupación correcta ('dia' o 'mes') para cada
    // rango; antes se comparaba con 'month' (inglés) y nunca acertaba, así que
    // los rangos largos personalizados salían en granularidad diaria.
    const r = { desde: rango.desde, hasta: rango.hasta, agrupacion: rango.agrupacion, limit: 6 };
    Promise.all([
      dashboardService.getResumen(r).catch(() => null),
      dashboardService.getIngresos(r).catch(() => null),
      dashboardService.getTopServicios(r).catch(() => []),
      dashboardService.getTopRepuestos(r).catch(() => []),
      dashboardService.getProductividad(r).catch(() => []),
    ]).then(([resumen, ingresos, topServicios, topRepuestos, productividad]) => {
      if (!vivo) return;
      setRep({
        resumen: resumen?.data ?? resumen,
        ingresos: ingresos?.data ?? ingresos,
        topServicios: (topServicios?.data ?? topServicios) || [],
        topRepuestos: (topRepuestos?.data ?? topRepuestos) || [],
        productividad: (productividad?.data ?? productividad) || [],
      });
      setLoading(false);
    });
    return () => { vivo = false; };
  }, [rango.desde, rango.hasta, rango.agrupacion, preset, refreshKey]);

  const resumen = rep.resumen || {};
  const ingresosSerie = (rep.ingresos?.series || []).map((s) => ({ name: etiquetaPeriodo(s.periodo, rep.ingresos.agrupacion), total: Number(s.total || 0) }));

  const repuestosPie = Array.isArray(repuestos?.porCategoria)
    ? repuestos.porCategoria.map(r => ({ name: r.Nombre || r.categoria || r.name, value: r.total || r.cantidad || 0 }))
    : [];

  const EMPTY_CHART = (
    <EmptyState variant="empty" title="Aún no hay datos suficientes" description="No hay órdenes entregadas en el rango elegido." />
  );

  return (
    <div className="page dashboard-page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Dashboard</h1>
          <p className="page__subtitle">Reportes del taller · {rango.desde} → {rango.hasta}</p>
        </div>
        <button className="btn btn--outline" onClick={() => setRefreshKey(k => k + 1)} disabled={loading}>
          <MdRefresh size={18} className={loading ? 'spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Selector de rango — control segmentado */}
      <div className="dashboard-rango">
        <div className="dashboard-rango__seg" role="tablist" aria-label="Rango de fechas">
          {RANGOS.map(r => (
            <button
              key={r.key}
              role="tab"
              aria-selected={preset === r.key}
              className={`dashboard-seg-btn${preset === r.key ? ' dashboard-seg-btn--active' : ''}`}
              onClick={() => {
                // Al pasar a "Personalizado" precargamos el mes actual para que
                // el rango sea usable de una vez (y no quede en blanco).
                if (r.key === 'custom' && !cDesde) {
                  const h = new Date();
                  setCDesde(fmt(new Date(h.getFullYear(), h.getMonth(), 1)));
                  setCHasta(fmt(h));
                }
                setPreset(r.key);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        {preset === 'custom' ? (
          <div className="dashboard-rango__custom">
            <input type="date" className="form-control" value={cDesde} max={cHasta || undefined} onChange={e => setCDesde(e.target.value)} />
            <span className="dashboard-rango__arrow">→</span>
            <input type="date" className="form-control" value={cHasta} min={cDesde || undefined} onChange={e => setCHasta(e.target.value)} />
          </div>
        ) : (
          <span className="dashboard-rango__summary">{rango.desde} → {rango.hasta}</span>
        )}
      </div>

      {/* KPIs */}
      <div className="stats-grid">
        <StatCard icon={MdPayments}   label="Ingreso del rango"  value={resumen.ingresoTotal ?? 0} format={formatCurrency} sub="Órdenes entregadas" color="green"  loading={loading} />
        <StatCard icon={MdReceiptLong} label="Órdenes realizadas" value={resumen.ordenesRealizadas ?? 0}          sub="En el rango"         color="blue"   loading={loading} />
        <StatCard icon={MdMiscellaneousServices} label="Ticket promedio" value={resumen.ticketPromedio ?? 0} format={formatCurrency} sub="Por orden"    color="amber"  loading={loading} />
        <StatCard icon={MdShoppingCart} label="Stock bajo"        value={resumen.stockBajo ?? 0}                  sub={resumen.stockCritico ? `${resumen.stockCritico} agotado(s)` : 'Repuestos'} color="purple" loading={loading} />
      </div>

      {(resumen.stockBajo > 0) && (
        <div className={`dashboard-stock-alerta ${resumen.stockCritico > 0 ? 'dashboard-stock-alerta--critico' : 'dashboard-stock-alerta--bajo'}`} style={{ cursor: 'pointer' }} onClick={() => navigate('/repuestos')} title="Ir a Repuestos">
          <MdWarning size={22} />
          <div><strong>{resumen.stockBajo} repuesto(s) con stock bajo</strong>{resumen.stockCritico > 0 && <span style={{ marginLeft: 8 }}>· {resumen.stockCritico} agotado(s)</span>}</div>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', opacity: 0.7 }}>Ver repuestos →</span>
        </div>
      )}

      {/* Ingresos */}
      <div className="dashboard-charts">
        <div className="card dashboard-chart-card dashboard-chart-card--wide">
          <div className="card__header"><span className="card__title">Ingresos ({formatCurrency(rep.ingresos?.total ?? 0)} en el rango)</span></div>
          <div className="card__body">
            {loading ? <Skeleton height={220} /> : ingresosSerie.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={ingresosSerie}>
                  <defs><linearGradient id="colorIng" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16a34a" stopOpacity={0.28} /><stop offset="60%" stopColor="#16a34a" stopOpacity={0.10} /><stop offset="100%" stopColor="#b5f23d" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid {...CHART_STYLE.grid} />
                  <XAxis dataKey="name" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_STYLE.tick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...CHART_STYLE.tooltip} formatter={(v) => [formatCurrency(v), 'Ingreso']} />
                  <Area type="monotone" dataKey="total" name="Ingreso" stroke="#16a34a" strokeWidth={2.5} fill="url(#colorIng)" isAnimationActive animationDuration={900} animationEasing="ease-out" />
                </AreaChart>
              </ResponsiveContainer>
            ) : EMPTY_CHART}
          </div>
        </div>
      </div>

      {/* Top servicios / Top repuestos */}
      <div className="dashboard-charts">
        <div className="card dashboard-chart-card">
          <div className="card__header"><span className="card__title">Servicios más realizados</span></div>
          <div className="card__body">
            {loading ? <Skeleton height={220} /> : rep.topServicios.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rep.topServicios.map(s => ({ name: s.nombre, value: s.veces }))} layout="vertical">
                  <defs><linearGradient id="gradServ" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#15803d" /><stop offset="100%" stopColor="#22c55e" /></linearGradient></defs>
                  <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                  <XAxis type="number" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} width={130} />
                  <Tooltip {...CHART_STYLE.tooltip} formatter={(v, _n, p) => [`${v} vez(es)`, p?.payload?.name]} />
                  <Bar dataKey="value" name="Veces" fill="url(#gradServ)" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            ) : EMPTY_CHART}
          </div>
        </div>

        <div className="card dashboard-chart-card">
          <div className="card__header"><span className="card__title">Repuestos más usados</span></div>
          <div className="card__body">
            {loading ? <Skeleton height={220} /> : rep.topRepuestos.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rep.topRepuestos.map(s => ({ name: s.nombre, value: s.cantidad }))} layout="vertical">
                  <defs><linearGradient id="gradRep" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#2563eb" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient></defs>
                  <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                  <XAxis type="number" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} width={130} />
                  <Tooltip {...CHART_STYLE.tooltip} formatter={(v, _n, p) => [`${v} unidad(es)`, p?.payload?.name]} />
                  <Bar dataKey="value" name="Cantidad" fill="url(#gradRep)" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            ) : EMPTY_CHART}
          </div>
        </div>
      </div>

      {/* Productividad + inventario por categoría */}
      <div className="dashboard-charts">
        <div className="card dashboard-chart-card">
          <div className="card__header"><span className="card__title"><MdBuild size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />Productividad por mecánico</span></div>
          <div className="card__body">
            {loading ? <Skeleton height={200} /> : rep.productividad.length > 0 ? (
              <>
                {rep.productividad.length > 5 && (
                  <SearchBar value={buscarMecanico} onChange={setBuscarMecanico} placeholder="Buscar mecánico..." />
                )}
                <div className="table-wrapper">
                  <table className="table">
                    <thead className="table__head"><tr><th className="table__th">Mecánico</th><th className="table__th table__th--num">Órdenes</th><th className="table__th table__th--num">Ingreso</th></tr></thead>
                    <tbody>
                      {filterItems(rep.productividad, buscarMecanico, ['empleado']).map((p, i) => (
                        <tr key={i} className="table__row">
                          <td className="table__td">{p.empleado}</td>
                          <td className="table__td table__td--num">{p.ordenes}</td>
                          <td className="table__td table__td--num">{formatCurrency(p.ingreso)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : EMPTY_CHART}
          </div>
        </div>

        {repuestosPie.length > 0 && (
          <div className="card dashboard-chart-card">
            <div className="card__header"><span className="card__title">Repuestos por categoría (inventario)</span></div>
            <div className="card__body">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={repuestosPie} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" nameKey="name" isAnimationActive animationDuration={900} animationEasing="ease-out">
                    {repuestosPie.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...CHART_STYLE.tooltip} formatter={(v, _n, p) => [v, p?.payload?.name]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', color: '#888' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
