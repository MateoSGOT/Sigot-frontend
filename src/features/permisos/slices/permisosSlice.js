import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { permisosService } from '../services/permisosService.js';

export const fetchPermisos = createAsyncThunk('permisos/fetchAll', async (_, { rejectWithValue }) => {
  try { const r = await permisosService.getAll(); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const createPermiso = createAsyncThunk('permisos/create', async (data, { rejectWithValue }) => {
  try { const r = await permisosService.create(data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const updatePermiso = createAsyncThunk('permisos/update', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await permisosService.update(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const togglePermisoEstado = createAsyncThunk('permisos/toggleEstado', async (id, { rejectWithValue }) => {
  try { const r = await permisosService.toggleEstado(id); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
// Keep for RolesPage detail panel
export const fetchPermisosByRol = createAsyncThunk('permisos/fetchByRol', async (id_rol, { rejectWithValue }) => {
  try { const r = await permisosService.getByRol(id_rol); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const savePermisosByRol = createAsyncThunk('permisos/saveByRol', async ({ id_rol, data }, { rejectWithValue }) => {
  try { const r = await permisosService.saveByRol(id_rol, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});

const permisosSlice = createSlice({
  name: 'permisos',
  initialState: { items: [], loading: false, actionLoading: false, error: null },
  reducers: { clearError(state) { state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchPermisos.pending,  s => { s.loading = true; s.error = null; })
     .addCase(fetchPermisos.fulfilled, (s, a) => { s.loading = false; s.items = Array.isArray(a.payload) ? a.payload : []; })
     .addCase(fetchPermisos.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
     .addCase(createPermiso.pending,  s => { s.actionLoading = true; })
     .addCase(createPermiso.fulfilled, (s, a) => { s.actionLoading = false; if (a.payload) s.items.push(a.payload); })
     .addCase(createPermiso.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload; })
     .addCase(updatePermiso.pending,  s => { s.actionLoading = true; })
     .addCase(updatePermiso.fulfilled, (s, a) => { s.actionLoading = false; const idx = s.items.findIndex(i => i.Id_Permiso === a.payload?.Id_Permiso); if (idx >= 0) s.items[idx] = a.payload; })
     .addCase(updatePermiso.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload; })
     .addCase(togglePermisoEstado.pending,  s => { s.actionLoading = true; })
     .addCase(togglePermisoEstado.fulfilled, (s, a) => { s.actionLoading = false; const idx = s.items.findIndex(i => i.Id_Permiso === a.payload?.Id_Permiso); if (idx >= 0) s.items[idx] = a.payload; })
     .addCase(togglePermisoEstado.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload; });
  },
});
export const { clearError } = permisosSlice.actions;
export default permisosSlice.reducer;
