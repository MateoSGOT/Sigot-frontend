import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { ordenesService } from '../services/ordenesService.js';

export const fetchOrdenes = createAsyncThunk('ordenes/fetchAll', async (_, { rejectWithValue }) => {
  try { const r = await ordenesService.getAll(); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const fetchOrdenById = createAsyncThunk('ordenes/fetchById', async (id, { rejectWithValue }) => {
  try { const r = await ordenesService.getById(id); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const updateOrden = createAsyncThunk('ordenes/update', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await ordenesService.update(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const toggleOrdenEstado = createAsyncThunk('ordenes/toggleEstado', async ({ id, Estado }, { rejectWithValue }) => {
  try { await ordenesService.toggleEstado(id, Estado); return { id, Estado }; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const addServicioToOrden = createAsyncThunk('ordenes/addServicio', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await ordenesService.addServicio(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const addRepuestoToOrden = createAsyncThunk('ordenes/addRepuesto', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await ordenesService.addRepuesto(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const setManoDeObra = createAsyncThunk('ordenes/setManoDeObra', async ({ id, valor }, { rejectWithValue }) => {
  try { const r = await ordenesService.setManoDeObra(id, valor); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});

const ordenesSlice = createSlice({
  name: 'ordenes',
  initialState: { items: [], selected: null, loading: false, error: null, actionLoading: false },
  reducers: { clearError(state) { state.error = null; }, clearSelected(state) { state.selected = null; } },
  extraReducers: (b) => {
    b.addCase(fetchOrdenes.pending, s => { s.loading=true; s.error=null; })
     .addCase(fetchOrdenes.fulfilled, (s,a) => { s.loading=false; s.items=Array.isArray(a.payload)?a.payload:[]; })
     .addCase(fetchOrdenes.rejected, (s,a) => { s.loading=false; s.error=a.payload; })
     .addCase(fetchOrdenById.fulfilled, (s,a) => { s.selected=a.payload; })
     .addCase(updateOrden.pending, s => { s.actionLoading=true; })
     .addCase(updateOrden.fulfilled, (s,a) => { s.actionLoading=false; const idx=s.items.findIndex(i=>i.Id_Orden===a.payload?.Id_Orden); if(idx>=0) s.items[idx]=a.payload; })
     .addCase(updateOrden.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(toggleOrdenEstado.fulfilled, (s,a) => { const item=s.items.find(i=>i.Id_Orden===a.payload.id); if(item) item.Estado=a.payload.Estado; })
     .addCase(addServicioToOrden.pending, s => { s.actionLoading=true; })
     .addCase(addServicioToOrden.fulfilled, (s,a) => { s.actionLoading=false; if(a.payload) s.selected=a.payload; })
     .addCase(addServicioToOrden.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(addRepuestoToOrden.pending, s => { s.actionLoading=true; })
     .addCase(addRepuestoToOrden.fulfilled, (s,a) => { s.actionLoading=false; if(a.payload) s.selected=a.payload; })
     .addCase(addRepuestoToOrden.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(setManoDeObra.pending, s => { s.actionLoading=true; })
     .addCase(setManoDeObra.fulfilled, (s,a) => { s.actionLoading=false; if(a.payload) s.selected=a.payload; })
     .addCase(setManoDeObra.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; });
  },
});
export const { clearError, clearSelected } = ordenesSlice.actions;
export default ordenesSlice.reducer;
