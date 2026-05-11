import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { comprasService } from '../services/comprasService.js';
export const fetchCompras = createAsyncThunk('compras/fetchAll', async (_, { rejectWithValue }) => {
  try { const r = await comprasService.getAll(); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const createCompra = createAsyncThunk('compras/create', async (data, { rejectWithValue }) => {
  try { const r = await comprasService.create(data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const anularCompra = createAsyncThunk('compras/anular', async (id, { rejectWithValue }) => {
  try { const r = await comprasService.anular(id); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
const comprasSlice = createSlice({
  name: 'compras',
  initialState: { items: [], loading: false, error: null, actionLoading: false },
  reducers: { clearError(state) { state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchCompras.pending, s => { s.loading=true; s.error=null; })
     .addCase(fetchCompras.fulfilled, (s,a) => { s.loading=false; s.items=Array.isArray(a.payload)?a.payload:[]; })
     .addCase(fetchCompras.rejected, (s,a) => { s.loading=false; s.error=a.payload; })
     .addCase(createCompra.pending, s => { s.actionLoading=true; })
     .addCase(createCompra.fulfilled, (s,a) => { s.actionLoading=false; if(a.payload) s.items.push(a.payload); })
     .addCase(createCompra.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(anularCompra.pending, s => { s.actionLoading=true; })
     .addCase(anularCompra.fulfilled, (s,a) => { s.actionLoading=false; const idx=s.items.findIndex(i=>i.Id_Compra===a.payload?.Id_Compra); if(idx>=0) s.items[idx]=a.payload; })
     .addCase(anularCompra.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; });
  },
});
export const { clearError } = comprasSlice.actions;
export default comprasSlice.reducer;
