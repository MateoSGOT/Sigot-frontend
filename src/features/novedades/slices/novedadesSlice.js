import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { novedadesService } from '../services/novedadesService.js';
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
const novedadesSlice = createSlice({
  name: 'novedades',
  initialState: { items: [], loading: false, error: null, actionLoading: false },
  reducers: { clearError(state) { state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchNovedades.pending, s => { s.loading=true; s.error=null; })
     .addCase(fetchNovedades.fulfilled, (s,a) => { s.loading=false; s.items=Array.isArray(a.payload)?a.payload:[]; })
     .addCase(fetchNovedades.rejected, (s,a) => { s.loading=false; s.error=a.payload; })
     .addCase(createNovedad.pending, s => { s.actionLoading=true; })
     .addCase(createNovedad.fulfilled, (s,a) => { s.actionLoading=false; if(a.payload) s.items.push(a.payload); })
     .addCase(createNovedad.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(updateNovedad.pending, s => { s.actionLoading=true; })
     .addCase(updateNovedad.fulfilled, (s,a) => { s.actionLoading=false; const idx=s.items.findIndex(i=>(i.Id_Novedad||i.id)===a.payload?.Id_Novedad); if(idx>=0) s.items[idx]=a.payload; })
     .addCase(updateNovedad.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; });
  },
});
export const { clearError } = novedadesSlice.actions;
export default novedadesSlice.reducer;
