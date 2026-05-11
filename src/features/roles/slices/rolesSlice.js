import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { rolesService } from '../services/rolesService.js';

export const fetchRoles = createAsyncThunk('roles/fetchAll', async (_, { rejectWithValue }) => {
  try { const r = await rolesService.getAll(); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const createRol = createAsyncThunk('roles/create', async (data, { rejectWithValue }) => {
  try { const r = await rolesService.create(data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const updateRol = createAsyncThunk('roles/update', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await rolesService.update(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const toggleRolEstado = createAsyncThunk('roles/toggleEstado', async (id, { rejectWithValue }) => {
  try { const r = await rolesService.toggleEstado(id); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});

const rolesSlice = createSlice({
  name: 'roles',
  initialState: { items: [], loading: false, actionLoading: false, error: null },
  reducers: { clearError(state) { state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchRoles.pending,  s => { s.loading = true; s.error = null; })
     .addCase(fetchRoles.fulfilled, (s, a) => { s.loading = false; s.items = Array.isArray(a.payload) ? a.payload : []; })
     .addCase(fetchRoles.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
     .addCase(createRol.pending,  s => { s.actionLoading = true; })
     .addCase(createRol.fulfilled, (s, a) => { s.actionLoading = false; if (a.payload) s.items.push(a.payload); })
     .addCase(createRol.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload; })
     .addCase(updateRol.pending,  s => { s.actionLoading = true; })
     .addCase(updateRol.fulfilled, (s, a) => { s.actionLoading = false; const idx = s.items.findIndex(i => i.Id_Rol === a.payload?.Id_Rol); if (idx >= 0) s.items[idx] = a.payload; })
     .addCase(updateRol.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload; })
     .addCase(toggleRolEstado.pending,  s => { s.actionLoading = true; })
     .addCase(toggleRolEstado.fulfilled, (s, a) => { s.actionLoading = false; const idx = s.items.findIndex(i => i.Id_Rol === a.payload?.Id_Rol); if (idx >= 0) s.items[idx] = a.payload; })
     .addCase(toggleRolEstado.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload; });
  },
});
export const { clearError } = rolesSlice.actions;
export default rolesSlice.reducer;
