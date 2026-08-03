import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchDashboard } from '../slices/dashboardSlice.js';
import {
  MdBuild, MdShoppingCart, MdMiscellaneousServices, MdPeople,
  MdInventory, MdRefresh, MdWarning
} from 'react-icons/md';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Area, AreaChart
} from 'recharts';
import EmptyState from '../../../shared/components/EmptyState/EmptyState.jsx';
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
  const navigate = useNavigate();
  const { repuestos, compras, servicios, empleados, stockBajo, loading, error } = useSelector((s) => s.dashboard);

  useEffect(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  const handleRefresh = () => dispatch(fetchDashboard());

  // Safely extract stats
  const totalRepuestos  = repuestos?.total ?? repuestos?.totalRepuestos ?? (Array.isArray(repuestos) ? repuestos.length : '—');
  const totalCompras    = compras?.total ?? compras?.totalCompras ?? (Array.isArray(compras) ? compras.length : '—');
  const totalServicios  = servicios?.total ?? servicios?.totalServicios ?? (Array.isArray(servicios) ? servicios.length : '—');
  const totalEmpleados  = empleados?.total ?? empleados?.totalEmpleados ?? (Array.isArray(empleados) ? empleados.length : '—');
  const stockBajoTotal  = stockBajo?.data?.total ?? stockBajo?.total ?? 0;
  const stockBajoCrit   = stockBajo?.data?.criticos ?? stockBajo?.criticos ?? 0;
  const montoCompras    = compras?.montoTotal ?? compras?.totalMonto ?? 0;

  // Chart data — fall back to placeholder when API returns nothing
  const repuestosChartData = Array.isArray(repuestos?.porCategoria)
    ? repuestos.porCategoria.map(r => ({ name: r.Nombre || r.categoria || r.name, value: r.total || r.cantidad || r.value || 0 }))
    : Array.isArray(repuestos)
    ? repuestos.slice(0, 6).map(r => ({ name: r.Nombre || r.nombre, value: r.Stock || r.stock || 0 }))
    : [];

  // Solo datos REALES de la API. Si no hay, el arreglo queda vacío y se muestra un estado
  // vacío honesto (nada de cifras inventadas). El dashboard con series reales es Tanda B.
  const comprasChartData = (() => {
    const real = Array.isArray(compras?.porMes) ? compras.porMes : [];
    return real.slice(0, 12).map((c, i) => ({
      name: c.mes || c.month || c.name || `Mes ${i + 1}`,
      total: Number(c.total || c.monto || c.value || 0),
    }));
  })();

  const serviciosChartData = (() => {
    if (Array.isArray(servicios?.top) && servicios.top.length > 0)
      return servicios.top.map(s => ({ name: s.Nombre || s.nombre, value: Number(s.total || s.count || 0) }));
    return [];
  })();

  const EMPTY_CHART = (
    <EmptyState
      variant="empty"
      title="Aún no hay datos suficientes"
      description="Este resumen se completará a medida que se registren movimientos."
    />
  );

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
        <StatCard icon={MdInventory}             label="Repuestos"  value={totalRepuestos} sub="En inventario"   color="green"  loading={loading} />
        <StatCard icon={MdShoppingCart}          label="Compras"    value={totalCompras}   sub={montoCompras ? `$${Number(montoCompras).toLocaleString('es-CO')} total` : 'Registradas'} color="blue"   loading={loading} />
        <StatCard icon={MdMiscellaneousServices} label="Servicios"  value={totalServicios} sub="Disponibles"    color="amber"  loading={loading} />
        <StatCard icon={MdPeople}                label="Empleados"  value={totalEmpleados} sub="En el sistema"  color="purple" loading={loading} />
      </div>
      {(stockBajoTotal > 0 || loading) && (
        <div
          className={`dashboard-stock-alerta ${stockBajoCrit > 0 ? 'dashboard-stock-alerta--critico' : 'dashboard-stock-alerta--bajo'}`}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/repuestos')}
          title="Ir a Repuestos"
        >
          <MdWarning size={22} />
          <div>
            <strong>{stockBajoTotal} repuesto(s) con stock bajo</strong>
            {stockBajoCrit > 0 && <span style={{ marginLeft: 8 }}>· {stockBajoCrit} agotado(s)</span>}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', opacity: 0.7 }}>Ver repuestos →</span>
        </div>
      )}

      {/* Charts */}
      <div className="dashboard-charts">
        {/* Compras por mes — solo con datos reales; si no, estado vacío honesto */}
        <div className="card dashboard-chart-card">
          <div className="card__header">
            <span className="card__title">Compras registradas</span>
          </div>
          <div className="card__body">
            {comprasChartData.length > 0 ? (
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
                  <Tooltip {...CHART_STYLE.tooltip} formatter={(val) => [`$${Number(val).toLocaleString('es-CO')}`, 'Total comprado']} />
                  <Area type="monotone" dataKey="total" name="Total comprado" stroke="#2d6a2d" strokeWidth={2.5} fill="url(#colorCompras)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : EMPTY_CHART}
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
                  <Pie data={repuestosChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" nameKey="name" name="Cantidad">
                    {repuestosChartData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...CHART_STYLE.tooltip} formatter={(val, _name, props) => [val, props?.payload?.name ?? 'Cantidad']} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', color: '#888' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Servicios más realizados — solo con datos reales; si no, estado vacío honesto */}
        <div className="card dashboard-chart-card dashboard-chart-card--wide">
          <div className="card__header">
            <span className="card__title">Servicios más realizados</span>
          </div>
          <div className="card__body">
            {serviciosChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={serviciosChartData} layout="vertical">
                  <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                  <XAxis type="number" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} width={140} />
                  <Tooltip {...CHART_STYLE.tooltip} formatter={(val, _name, props) => [val, props?.payload?.name ?? 'Cantidad']} />
                  <Bar dataKey="value" name="Cantidad" fill="#2d6a2d" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : EMPTY_CHART}
          </div>
        </div>
      </div>
    </div>
  );
}
