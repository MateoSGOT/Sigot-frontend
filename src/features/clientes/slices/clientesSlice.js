import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { clientesService } from '../services/clientesService.js';

const normEstado = (v) => v === true ? 1 : v === false ? 0 : Number(v);
const norm = (c) => ({ ...c, Estado: normEstado(c.Estado) });

export const fetchClientes = createAsyncThunk('clientes/fetchAll', async (_, { rejectWithValue }) => {
  try { const r = await clientesService.getAll(); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error al cargar clientes'); }
});
export const createCliente = createAsyncThunk('clientes/create', async (data, { rejectWithValue }) => {
  try { const r = await clientesService.create(data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error al crear cliente'); }
});
export const updateCliente = createAsyncThunk('clientes/update', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await clientesService.update(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error al actualizar cliente'); }
});
export const toggleClienteEstado = createAsyncThunk('clientes/toggleEstado', async ({ id, Estado }, { rejectWithValue }) => {
  try { await clientesService.toggleEstado(id, Estado); return { id, Estado }; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error al cambiar estado'); }
});

const clientesSlice = createSlice({
  name: 'clientes',
  initialState: { items: [], loading: false, error: null, actionLoading: false },
  reducers: { clearError(state) { state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchClientes.pending, (s) => { s.loading = true; s.error = null; })
     .addCase(fetchClientes.fulfilled, (s, a) => { s.loading = false; s.items = Array.isArray(a.payload) ? a.payload.map(norm) : []; })
     .addCase(fetchClientes.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
     .addCase(createCliente.pending, (s) => { s.actionLoading = true; })
     .addCase(createCliente.fulfilled, (s, a) => { s.actionLoading = false; if(a.payload) s.items.push(norm(a.payload)); })
     .addCase(createCliente.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload; })
     .addCase(updateCliente.pending, (s) => { s.actionLoading = true; })
     .addCase(updateCliente.fulfilled, (s, a) => { s.actionLoading = false; const n = norm(a.payload || {}); const idx = s.items.findIndex(i => i.Id_Cliente === n.Id_Cliente); if(idx>=0) s.items[idx] = n; })
     .addCase(updateCliente.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload; })
     .addCase(toggleClienteEstado.fulfilled, (s, a) => { const item = s.items.find(i => i.Id_Cliente === a.payload.id); if(item) item.Estado = normEstado(a.payload.Estado); });
  },
});
export const { clearError } = clientesSlice.actions;
export default clientesSlice.reducer;
