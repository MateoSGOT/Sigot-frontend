import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDashboard } from '../slices/dashboardSlice.js';
import {
  MdBuild, MdShoppingCart, MdMiscellaneousServices, MdPeople,
  MdInventory, MdRefresh
} from 'react-icons/md';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Area, AreaChart
} from 'recharts';
import './DashboardPage.css';

// Serious, muted professional palette for donut chart
const PIE_COLORS = ['#3a6b9e', '#8b2e2e', '#2d5a2d', '#8a7240', '#5c6b8a', '#7a4a6a', '#4a6b5c'];

const CHART_STYLE = {
  tooltip: {
    contentStyle: {
      background: '#ffffff',
      border: '1px solid rgba(0,0,0,0.10)',
      borderRadius: '8px',
      color: '#111111',
      fontSize: '0.8125rem',
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
    },
    labelStyle: { color: '#6b7280' },
    cursor: { fill: 'rgba(0,0,0,0.03)' },
  },
  grid: { strokeDasharray: '3 3', stroke: 'rgba(0,0,0,0.07)' },
  tick: { fontSize: 12, fill: '#9ca3af' },
};

// Placeholder data shown when API returns no data
const PLACEHOLDER_COMPRAS = [
  { name: 'Oct', total: 1200000 },
  { name: 'Nov', total: 2800000 },
  { name: 'Dic', total: 1900000 },
  { name: 'Ene', total: 3400000 },
  { name: 'Feb', total: 2100000 },
  { name: 'Mar', total: 4200000 },
];

const PLACEHOLDER_SERVICIOS = [
  { name: 'Cambio de aceite', value: 45 },
  { name: 'Alineación', value: 38 },
  { name: 'Frenos', value: 31 },
  { name: 'Diagnóstico eléctrico', value: 27 },
  { name: 'Revisión general', value: 19 },
];

function StatCard({ icon: Icon, label, value, sub, color = 'green', loading }) {
  return (
    <div className={`stat-card stat-card--${color}`}>
      <div className="stat-card__icon-wrap">
        <Icon size={24} />
      </div>
      <div className="stat-card__body">
        <span className="stat-card__label">{label}</span>
        {loading ? (
          <span className="stat-card__value stat-card__value--loading">—</span>
        ) : (
          <span className="stat-card__value">{value ?? '—'}</span>
        )}
        {sub && <span className="stat-card__sub">{sub}</span>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const dispatch = useDispatch();
  const { repuestos, compras, servicios, empleados, loading, error } = useSelector((s) => s.dashboard);

  useEffect(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  const handleRefresh = () => dispatch(fetchDashboard());

  // Safely extract stats
  const totalRepuestos = repuestos?.total ?? repuestos?.totalRepuestos ?? (Array.isArray(repuestos) ? repuestos.length : '—');
  const totalCompras   = compras?.total ?? compras?.totalCompras ?? (Array.isArray(compras) ? compras.length : '—');
  const totalServicios = servicios?.total ?? servicios?.totalServicios ?? (Array.isArray(servicios) ? servicios.length : '—');
  const totalEmpleados = empleados?.total ?? empleados?.totalEmpleados ?? (Array.isArray(empleados) ? empleados.length : '—');
  const stockBajo      = repuestos?.stockBajo ?? repuestos?.sinStock ?? 0;
  const montoCompras   = compras?.montoTotal ?? compras?.totalMonto ?? 0;

  // Chart data — fall back to placeholder when API returns nothing
  const repuestosChartData = Array.isArray(repuestos?.porCategoria)
    ? repuestos.porCategoria.map(r => ({ name: r.Nombre || r.categoria || r.name, value: r.total || r.cantidad || r.value || 0 }))
    : Array.isArray(repuestos)
    ? repuestos.slice(0, 6).map(r => ({ name: r.Nombre || r.nombre, value: r.Stock || r.stock || 0 }))
    : [];

  const comprasChartData = (() => {
    const real = Array.isArray(compras?.porMes) ? compras.porMes : Array.isArray(compras) ? compras : [];
    if (real.length > 0) {
      return real.slice(0, 6).map((c, i) => ({
        name: c.mes || c.month || c.name || `Mes ${i + 1}`,
        total: c.total || c.monto || c.value || c.PrecioUnitario || 0,
      }));
    }
    return PLACEHOLDER_COMPRAS;
  })();

  const serviciosChartData = (() => {
    if (Array.isArray(servicios?.top) && servicios.top.length > 0)
      return servicios.top.map(s => ({ name: s.Nombre || s.nombre, value: s.total || s.count || 0 }));
    if (Array.isArray(servicios) && servicios.length > 0) {
      const mapped = servicios.slice(0, 5).map(s => ({ name: s.Nombre || s.nombre, value: s.Precio || 0 }));
      if (mapped.some(d => d.value > 0)) return mapped;
    }
    return PLACEHOLDER_SERVICIOS;
  })();

  return (
    <div className="page dashboard-page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Dashboard</h1>
          <p className="page__subtitle">Resumen general del sistema SIGOT</p>
        </div>
        <button className="btn btn--outline" onClick={handleRefresh} disabled={loading}>
          <MdRefresh size={18} className={loading ? 'spin' : ''} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="dashboard-error">
          <span>Error al cargar datos: {error}</span>
          <button className="btn btn--primary btn--sm" onClick={handleRefresh}>Reintentar</button>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <StatCard icon={MdInventory}             label="Repuestos" value={totalRepuestos} sub={stockBajo ? `${stockBajo} con stock bajo` : 'En inventario'} color="green"  loading={loading} />
        <StatCard icon={MdShoppingCart}          label="Compras"   value={totalCompras}   sub={montoCompras ? `$${Number(montoCompras).toLocaleString('es-CO')} total` : 'Registradas'}        color="blue"   loading={loading} />
        <StatCard icon={MdMiscellaneousServices} label="Servicios" value={totalServicios} sub="Disponibles"   color="amber"  loading={loading} />
        <StatCard icon={MdPeople}                label="Empleados" value={totalEmpleados} sub="En el sistema" color="purple" loading={loading} />
      </div>

      {/* Charts */}
      <div className="dashboard-charts">
        {/* Compras por mes — always shows (placeholder if no data) */}
        <div className="card dashboard-chart-card">
          <div className="card__header">
            <span className="card__title">Compras registradas</span>
          </div>
          <div className="card__body">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={comprasChartData}>
                <defs>
                  <linearGradient id="colorCompras" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2d6a2d" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#2d6a2d" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid {...CHART_STYLE.grid} />
                <XAxis dataKey="name" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_STYLE.tick} axisLine={false} tickLine={false} />
                <Tooltip {...CHART_STYLE.tooltip} />
                <Area type="monotone" dataKey="total" stroke="#2d6a2d" strokeWidth={2.5} fill="url(#colorCompras)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Repuestos por categoría — differentiated colors */}
        {repuestosChartData.length > 0 && (
          <div className="card dashboard-chart-card">
            <div className="card__header">
              <span className="card__title">Repuestos por categoría</span>
            </div>
            <div className="card__body">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={repuestosChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                    {repuestosChartData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...CHART_STYLE.tooltip} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', color: '#888' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Servicios — always shows (placeholder if no data) */}
        <div className="card dashboard-chart-card dashboard-chart-card--wide">
          <div className="card__header">
            <span className="card__title">Servicios disponibles</span>
          </div>
          <div className="card__body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={serviciosChartData} layout="vertical">
                <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                <XAxis type="number" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} width={140} />
                <Tooltip {...CHART_STYLE.tooltip} />
                <Bar dataKey="value" fill="#2d6a2d" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
