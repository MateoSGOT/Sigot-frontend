import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { serviciosService } from '../services/serviciosService.js';

const normEstado = (v) => v === true ? 1 : v === false ? 0 : Number(v);
const norm = (item) => ({ ...item, Estado: normEstado(item.Estado) });

export const fetchServicios = createAsyncThunk('servicios/fetchAll', async (_, { rejectWithValue }) => {
  try { const r = await serviciosService.getAll(); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const createServicio = createAsyncThunk('servicios/create', async (data, { rejectWithValue }) => {
  try { const r = await serviciosService.create(data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const updateServicio = createAsyncThunk('servicios/update', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await serviciosService.update(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const toggleServicioEstado = createAsyncThunk('servicios/toggleEstado', async ({ id, Estado }, { rejectWithValue }) => {
  try { await serviciosService.toggleEstado(id, Estado); return { id, Estado }; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});

const serviciosSlice = createSlice({
  name: 'servicios',
  initialState: { items: [], loading: false, error: null, actionLoading: false },
  reducers: { clearError(state) { state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchServicios.pending, s => { s.loading=true; s.error=null; })
     .addCase(fetchServicios.fulfilled, (s,a) => { s.loading=false; s.items=Array.isArray(a.payload)?a.payload.map(norm):[]; })
     .addCase(fetchServicios.rejected, (s,a) => { s.loading=false; s.error=a.payload; })
     .addCase(createServicio.pending, s => { s.actionLoading=true; })
     .addCase(createServicio.fulfilled, (s,a) => { s.actionLoading=false; if(a.payload) s.items.push(norm(a.payload)); })
     .addCase(createServicio.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(updateServicio.pending, s => { s.actionLoading=true; })
     .addCase(updateServicio.fulfilled, (s,a) => { s.actionLoading=false; const n=norm(a.payload||{}); const idx=s.items.findIndex(i=>i.Id_Servicio===n.Id_Servicio); if(idx>=0) s.items[idx]=n; })
     .addCase(updateServicio.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(toggleServicioEstado.fulfilled, (s,a) => { const item=s.items.find(i=>i.Id_Servicio===a.payload.id); if(item) item.Estado=normEstado(a.payload.Estado); });
  },
});
export const { clearError } = serviciosSlice.actions;
export default serviciosSlice.reducer;
