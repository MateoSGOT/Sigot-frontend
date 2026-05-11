import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { agendaService } from '../services/agendaService.js';
export const fetchAgenda = createAsyncThunk('agenda/fetchAll', async (_, { rejectWithValue }) => {
  try { const r = await agendaService.getAll(); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const createCita = createAsyncThunk('agenda/create', async (data, { rejectWithValue }) => {
  try { const r = await agendaService.create(data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const updateCita = createAsyncThunk('agenda/update', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await agendaService.update(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const toggleCitaEstado = createAsyncThunk('agenda/toggleEstado', async ({ id, Estado }, { rejectWithValue }) => {
  try { await agendaService.toggleEstado(id, Estado); return { id, Estado }; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const generarOrdenDeCita = createAsyncThunk('agenda/generarOrden', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await agendaService.generarOrden(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error al generar orden'); }
});
const agendaSlice = createSlice({
  name: 'agenda',
  initialState: { items: [], loading: false, error: null, actionLoading: false },
  reducers: { clearError(state) { state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchAgenda.pending, s => { s.loading=true; s.error=null; })
     .addCase(fetchAgenda.fulfilled, (s,a) => { s.loading=false; s.items=Array.isArray(a.payload)?a.payload:[]; })
     .addCase(fetchAgenda.rejected, (s,a) => { s.loading=false; s.error=a.payload; })
     .addCase(createCita.pending, s => { s.actionLoading=true; })
     .addCase(createCita.fulfilled, (s,a) => { s.actionLoading=false; if(a.payload) s.items.push(a.payload); })
     .addCase(createCita.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(updateCita.pending, s => { s.actionLoading=true; })
     .addCase(updateCita.fulfilled, (s,a) => { s.actionLoading=false; const idx=s.items.findIndex(i=>(i.Id_Agenda||i.id)===a.payload?.Id_Agenda); if(idx>=0) s.items[idx]=a.payload; })
     .addCase(updateCita.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(toggleCitaEstado.fulfilled, (s,a) => { const item=s.items.find(i=>(i.Id_Agenda||i.id)===a.payload.id); if(item) item.Estado=a.payload.Estado; })
     .addCase(generarOrdenDeCita.pending, s => { s.actionLoading=true; })
     .addCase(generarOrdenDeCita.fulfilled, s => { s.actionLoading=false; })
     .addCase(generarOrdenDeCita.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; });
  },
});
export const { clearError } = agendaSlice.actions;
export default agendaSlice.reducer;
