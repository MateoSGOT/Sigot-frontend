import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { marcasService } from '../services/marcasService.js';

const normEstado = (v) => v === true ? 1 : v === false ? 0 : Number(v);
const normModelo = (m) => ({ ...m, Estado: normEstado(m.Estado) });
const norm = (m) => ({ ...m, Estado: normEstado(m.Estado), modelos: Array.isArray(m.modelos) ? m.modelos.map(normModelo) : [] });

export const fetchMarcas = createAsyncThunk('marcas/fetchAll', async (_, { rejectWithValue }) => {
  try { const r = await marcasService.getAll(); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const createMarca = createAsyncThunk('marcas/create', async (data, { rejectWithValue }) => {
  try { const r = await marcasService.create(data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const updateMarca = createAsyncThunk('marcas/update', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await marcasService.update(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const toggleMarcaEstado = createAsyncThunk('marcas/toggleEstado', async ({ id, Estado }, { rejectWithValue }) => {
  try { await marcasService.toggleEstado(id, Estado); return { id, Estado }; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});

// Modelos: tras cualquier cambio se refresca la lista para traer modelos actualizados.
export const createModelo = createAsyncThunk('marcas/createModelo', async ({ idMarca, data }, { rejectWithValue, dispatch }) => {
  try { const r = await marcasService.createModelo(idMarca, data); dispatch(fetchMarcas()); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const updateModelo = createAsyncThunk('marcas/updateModelo', async ({ id, data }, { rejectWithValue, dispatch }) => {
  try { const r = await marcasService.updateModelo(id, data); dispatch(fetchMarcas()); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const toggleModeloEstado = createAsyncThunk('marcas/toggleModeloEstado', async ({ id, Estado }, { rejectWithValue, dispatch }) => {
  try { await marcasService.toggleModeloEstado(id, Estado); dispatch(fetchMarcas()); return { id, Estado }; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});

const marcasSlice = createSlice({
  name: 'marcas',
  initialState: { items: [], loading: false, error: null, actionLoading: false },
  reducers: { clearError(state) { state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchMarcas.pending, s => { s.loading = true; s.error = null; })
     .addCase(fetchMarcas.fulfilled, (s, a) => { s.loading = false; s.items = Array.isArray(a.payload) ? a.payload.map(norm) : []; })
     .addCase(fetchMarcas.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
     .addCase(createMarca.pending, s => { s.actionLoading = true; })
     .addCase(createMarca.fulfilled, (s, a) => { s.actionLoading = false; if (a.payload) s.items.push(norm(a.payload)); })
     .addCase(createMarca.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload; })
     .addCase(updateMarca.pending, s => { s.actionLoading = true; })
     .addCase(updateMarca.fulfilled, (s, a) => { s.actionLoading = false; const n = norm(a.payload || {}); const i = s.items.findIndex(x => x.Id_Marca === n.Id_Marca); if (i >= 0) s.items[i] = { ...s.items[i], ...n }; })
     .addCase(updateMarca.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload; })
     .addCase(toggleMarcaEstado.fulfilled, (s, a) => { const m = s.items.find(x => x.Id_Marca === a.payload.id); if (m) m.Estado = normEstado(a.payload.Estado); })
     .addCase(createModelo.pending, s => { s.actionLoading = true; })
     .addCase(createModelo.fulfilled, s => { s.actionLoading = false; })
     .addCase(createModelo.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload; })
     .addCase(updateModelo.pending, s => { s.actionLoading = true; })
     .addCase(updateModelo.fulfilled, s => { s.actionLoading = false; })
     .addCase(updateModelo.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload; });
  },
});
export const { clearError } = marcasSlice.actions;
export default marcasSlice.reducer;
