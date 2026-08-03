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

// 'YYYY-MM-DD' -> etiqueta corta según agrupación.
const etiquetaPeriodo = (ymd, agrupacion) => {
  const [y, m, d] = ymd.split('-');
  if (agrupacion === 'month') return `${MESES[Number(m) - 1]} ${y}`;
  if (agrupacion === 'week')  return `Sem ${d}/${m}`;
  return `${d}/${m}`;
};

function StatCard({ icon: Icon, label, value, sub, color = 'green', loading }) {
  return (
    <div className={`stat-card stat-card--${color}`}>
      <div className="stat-card__icon-wrap"><Icon size={24} /></div>
      <div className="stat-card__body">
        <span className="stat-card__label">{label}</span>
        {loading ? <Skeleton width={90} height={22} /> : <span className="stat-card__value">{value ?? '—'}</span>}
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

  useEffect(() => { dispatch(fetchDashboard()); }, [dispatch]);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    const r = { desde: rango.desde, hasta: rango.hasta, agrupacion: preset === 'anio' ? 'mes' : (rango.agrupacion === 'month' ? 'mes' : 'dia'), limit: 6 };
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
  }, [rango.desde, rango.hasta, rango.agrupacion, preset]);

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
        <button className="btn btn--outline" onClick={() => setPreset(p => p)} disabled={loading}>
          <MdRefresh size={18} className={loading ? 'spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Selector de rango */}
      <div className="dashboard-rango">
        <div className="dashboard-rango__presets">
          {RANGOS.map(r => (
            <button key={r.key} className={`btn btn--sm ${preset === r.key ? 'btn--primary' : 'btn--outline'}`} onClick={() => setPreset(r.key)}>{r.label}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="dashboard-rango__custom">
            <input type="date" className="form-control" value={cDesde} max={cHasta || undefined} onChange={e => setCDesde(e.target.value)} />
            <span>→</span>
            <input type="date" className="form-control" value={cHasta} min={cDesde || undefined} onChange={e => setCHasta(e.target.value)} />
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="stats-grid">
        <StatCard icon={MdPayments}   label="Ingreso del rango"  value={formatCurrency(resumen.ingresoTotal ?? 0)} sub="Órdenes entregadas" color="green"  loading={loading} />
        <StatCard icon={MdReceiptLong} label="Órdenes realizadas" value={resumen.ordenesRealizadas ?? 0}          sub="En el rango"         color="blue"   loading={loading} />
        <StatCard icon={MdMiscellaneousServices} label="Ticket promedio" value={formatCurrency(resumen.ticketPromedio ?? 0)} sub="Por orden"    color="amber"  loading={loading} />
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
                  <defs><linearGradient id="colorIng" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2d6a2d" stopOpacity={0.18} /><stop offset="95%" stopColor="#2d6a2d" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid {...CHART_STYLE.grid} />
                  <XAxis dataKey="name" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_STYLE.tick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...CHART_STYLE.tooltip} formatter={(v) => [formatCurrency(v), 'Ingreso']} />
                  <Area type="monotone" dataKey="total" name="Ingreso" stroke="#2d6a2d" strokeWidth={2.5} fill="url(#colorIng)" />
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
                  <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                  <XAxis type="number" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} width={130} />
                  <Tooltip {...CHART_STYLE.tooltip} formatter={(v, _n, p) => [`${v} vez(es)`, p?.payload?.name]} />
                  <Bar dataKey="value" name="Veces" fill="#2d6a2d" radius={[0, 4, 4, 0]} />
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
                  <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                  <XAxis type="number" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} width={130} />
                  <Tooltip {...CHART_STYLE.tooltip} formatter={(v, _n, p) => [`${v} unidad(es)`, p?.payload?.name]} />
                  <Bar dataKey="value" name="Cantidad" fill="#3a6b9e" radius={[0, 4, 4, 0]} />
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
              <div className="table-wrapper">
                <table className="table">
                  <thead className="table__head"><tr><th className="table__th">Mecánico</th><th className="table__th table__th--num">Órdenes</th><th className="table__th table__th--num">Ingreso</th></tr></thead>
                  <tbody>
                    {rep.productividad.map((p, i) => (
                      <tr key={i} className="table__row">
                        <td className="table__td">{p.empleado}</td>
                        <td className="table__td table__td--num">{p.ordenes}</td>
                        <td className="table__td table__td--num">{formatCurrency(p.ingreso)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : EMPTY_CHART}
          </div>
        </div>

        {repuestosPie.length > 0 && (
          <div className="card dashboard-chart-card">
            <div className="card__header"><span className="card__title">Repuestos por categoría (inventario)</span></div>
            <div className="card__body">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={repuestosPie} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" nameKey="name">
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
