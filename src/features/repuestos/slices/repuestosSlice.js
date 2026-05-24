import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { repuestosService } from '../services/repuestosService.js';

const normEstado = (v) => v === true ? 1 : v === false ? 0 : Number(v);
const norm = (r) => ({
  ...r,
  Nombre: r.NombreRepuesto ?? r.Nombre,
  Id_Categoria: r.Id_categoria ?? r.Id_Categoria,
  Estado: normEstado(r.Estado),
});

export const fetchRepuestos = createAsyncThunk('repuestos/fetchAll', async (_, { rejectWithValue }) => {
  try { const r = await repuestosService.getAll(); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const createRepuesto = createAsyncThunk('repuestos/create', async (data, { rejectWithValue }) => {
  try { const r = await repuestosService.create(data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const updateRepuesto = createAsyncThunk('repuestos/update', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await repuestosService.update(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const toggleRepuestoEstado = createAsyncThunk('repuestos/toggleEstado', async ({ id, Estado }, { rejectWithValue }) => {
  try { await repuestosService.toggleEstado(id, Estado); return { id, Estado }; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
const repuestosSlice = createSlice({
  name: 'repuestos',
  initialState: { items: [], loading: false, error: null, actionLoading: false },
  reducers: { clearError(state) { state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchRepuestos.pending, s => { s.loading=true; s.error=null; })
     .addCase(fetchRepuestos.fulfilled, (s,a) => { s.loading=false; s.items=Array.isArray(a.payload)?a.payload.map(norm):[]; })
     .addCase(fetchRepuestos.rejected, (s,a) => { s.loading=false; s.error=a.payload; })
     .addCase(createRepuesto.pending, s => { s.actionLoading=true; })
     .addCase(createRepuesto.fulfilled, (s,a) => { s.actionLoading=false; if(a.payload) s.items.push(norm(a.payload)); })
     .addCase(createRepuesto.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(updateRepuesto.pending, s => { s.actionLoading=true; })
     .addCase(updateRepuesto.fulfilled, (s,a) => { s.actionLoading=false; const n=norm(a.payload||{}); const idx=s.items.findIndex(i=>i.Id_Repuesto===n.Id_Repuesto); if(idx>=0) s.items[idx]=n; })
     .addCase(updateRepuesto.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(toggleRepuestoEstado.fulfilled, (s,a) => { const item=s.items.find(i=>i.Id_Repuesto===a.payload.id); if(item) item.Estado=normEstado(a.payload.Estado); });
  },
});
export const { clearError } = repuestosSlice.actions;
export default repuestosSlice.reducer;
