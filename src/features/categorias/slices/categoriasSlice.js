import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { categoriasService } from '../services/categoriasService.js';
export const fetchCategorias = createAsyncThunk('categorias/fetchAll', async (_, { rejectWithValue }) => {
  try { const r = await categoriasService.getAll(); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const createCategoria = createAsyncThunk('categorias/create', async (data, { rejectWithValue }) => {
  try { const r = await categoriasService.create(data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const updateCategoria = createAsyncThunk('categorias/update', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await categoriasService.update(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const toggleCategoriaEstado = createAsyncThunk('categorias/toggleEstado', async ({ id, Estado }, { rejectWithValue }) => {
  try { await categoriasService.toggleEstado(id, Estado); return { id, Estado }; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
const categoriasSlice = createSlice({
  name: 'categorias',
  initialState: { items: [], loading: false, error: null, actionLoading: false },
  reducers: { clearError(state) { state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchCategorias.pending, s => { s.loading=true; s.error=null; })
     .addCase(fetchCategorias.fulfilled, (s,a) => { s.loading=false; s.items=Array.isArray(a.payload)?a.payload:[]; })
     .addCase(fetchCategorias.rejected, (s,a) => { s.loading=false; s.error=a.payload; })
     .addCase(createCategoria.pending, s => { s.actionLoading=true; })
     .addCase(createCategoria.fulfilled, (s,a) => { s.actionLoading=false; if(a.payload) s.items.push(a.payload); })
     .addCase(createCategoria.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(updateCategoria.pending, s => { s.actionLoading=true; })
     .addCase(updateCategoria.fulfilled, (s,a) => { s.actionLoading=false; const idx=s.items.findIndex(i=>i.Id_Categoria===a.payload?.Id_Categoria); if(idx>=0) s.items[idx]=a.payload; })
     .addCase(updateCategoria.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(toggleCategoriaEstado.fulfilled, (s,a) => { const item=s.items.find(i=>i.Id_Categoria===a.payload.id); if(item) item.Estado=a.payload.Estado; });
  },
});
export const { clearError } = categoriasSlice.actions;
export default categoriasSlice.reducer;
