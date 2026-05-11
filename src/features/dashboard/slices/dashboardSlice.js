import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dashboardService } from '../services/dashboardService.js';

export const fetchDashboard = createAsyncThunk('dashboard/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const [repuestos, compras, servicios, empleados] = await Promise.all([
      dashboardService.getRepuestos(),
      dashboardService.getCompras(),
      dashboardService.getServicios(),
      dashboardService.getEmpleados(),
    ]);
    return {
      repuestos: repuestos.data || repuestos,
      compras: compras.data || compras,
      servicios: servicios.data || servicios,
      empleados: empleados.data || empleados,
    };
  } catch (err) {
    return rejectWithValue(err?.response?.data?.message || 'Error al cargar dashboard');
  }
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
