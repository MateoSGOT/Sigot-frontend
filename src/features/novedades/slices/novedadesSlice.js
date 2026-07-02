import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { novedadesService } from '../services/novedadesService.js';

const normEstado = (v) => v === true ? 1 : v === false ? 0 : Number(v);
const norm = (n) => ({ ...n, Estado: normEstado(n.Estado) });

export const fetchNovedades = createAsyncThunk('novedades/fetchAll', async (_, { rejectWithValue }) => {
  try { const r = await novedadesService.getAll(); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const createNovedad = createAsyncThunk('novedades/create', async (data, { rejectWithValue }) => {
  try { const r = await novedadesService.create(data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const updateNovedad = createAsyncThunk('novedades/update', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await novedadesService.update(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const toggleNovedadEstado = createAsyncThunk('novedades/toggleEstado', async ({ id, Estado }, { rejectWithValue }) => {
  try { await novedadesService.toggleEstado(id, Estado); return { id, Estado }; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
const novedadesSlice = createSlice({
  name: 'novedades',
  initialState: { items: [], loading: false, error: null, actionLoading: false },
  reducers: { clearError(state) { state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchNovedades.pending, s => { s.loading=true; s.error=null; })
     .addCase(fetchNovedades.fulfilled, (s,a) => { s.loading=false; s.items=Array.isArray(a.payload)?a.payload.map(norm):[]; })
     .addCase(fetchNovedades.rejected, (s,a) => { s.loading=false; s.error=a.payload; })
     .addCase(createNovedad.pending, s => { s.actionLoading=true; })
     .addCase(createNovedad.fulfilled, (s,a) => { s.actionLoading=false; if(a.payload) s.items.push(norm(a.payload)); })
     .addCase(createNovedad.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(updateNovedad.pending, s => { s.actionLoading=true; })
     .addCase(updateNovedad.fulfilled, (s,a) => { s.actionLoading=false; const n=norm(a.payload||{}); const idx=s.items.findIndex(i=>(i.Id_Novedad||i.id)===n.Id_Novedad); if(idx>=0) s.items[idx]=n; })
     .addCase(updateNovedad.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(toggleNovedadEstado.fulfilled, (s,a) => { const item=s.items.find(i=>(i.Id_Novedad||i.id)===a.payload.id); if(item) item.Estado=normEstado(a.payload.Estado); });
  },
});
export const { clearError } = novedadesSlice.actions;
export default novedadesSlice.reducer;
