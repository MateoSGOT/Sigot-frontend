import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dashboardService } from '../services/dashboardService.js';

const safeGet = async (fn) => {
  try { const r = await fn(); return r?.data ?? r; }
  catch { return null; }
};

export const fetchDashboard = createAsyncThunk('dashboard/fetchAll', async () => {
  const [repuestos, compras, servicios, empleados] = await Promise.all([
    safeGet(dashboardService.getRepuestos),
    safeGet(dashboardService.getCompras),
    safeGet(dashboardService.getServicios),
    safeGet(dashboardService.getEmpleados),
  ]);
  return { repuestos, compras, servicios, empleados };
});

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    repuestos: null,
    compras: null,
    servicios: null,
    empleados: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.repuestos = action.payload.repuestos;
        state.compras = action.payload.compras;
        state.servicios = action.payload.servicios;
        state.empleados = action.payload.empleados;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default dashboardSlice.reducer;
