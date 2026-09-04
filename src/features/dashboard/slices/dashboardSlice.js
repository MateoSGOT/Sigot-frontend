import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dashboardService } from '../services/dashboardService.js';

const safeGet = async (fn) => {
  try { const r = await fn(); return r?.data ?? r; }
  catch { return null; }
};

// Solo `repuestos` se lee en algún componente (gráfico "Repuestos por categoría" de
// DashboardPage.jsx) -- compras/servicios/empleados/stockBajo se pedían en cada carga y
// cada "Actualizar" sin que ninguna pantalla los leyera nunca; se dejaron de pedir.
export const fetchDashboard = createAsyncThunk('dashboard/fetchAll', async () => {
  const repuestos = await safeGet(dashboardService.getRepuestos);
  return { repuestos };
});

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    repuestos: null,
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
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default dashboardSlice.reducer;
