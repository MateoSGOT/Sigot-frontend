import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { proveedoresService } from '../services/proveedoresService.js';

const normEstado = (v) => v === true ? 1 : v === false ? 0 : Number(v);
const norm = (p) => ({
  ...p,
  Id_Proveedor: p.id_proveedor ?? p.Id_Proveedor,
  Nombre: p.nombre ?? p.Nombre,
  Correo: p.correo ?? p.Correo,
  Contacto: p.contacto ?? p.Contacto,
  Estado: normEstado(p.Estado),
});

export const fetchProveedores = createAsyncThunk('proveedores/fetchAll', async (_, { rejectWithValue }) => {
  try { const r = await proveedoresService.getAll(); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const createProveedor = createAsyncThunk('proveedores/create', async (data, { rejectWithValue }) => {
  try { const r = await proveedoresService.create(data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const updateProveedor = createAsyncThunk('proveedores/update', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await proveedoresService.update(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const toggleProveedorEstado = createAsyncThunk('proveedores/toggleEstado', async ({ id, Estado }, { rejectWithValue }) => {
  try { await proveedoresService.toggleEstado(id, Estado); return { id, Estado }; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
const proveedoresSlice = createSlice({
  name: 'proveedores',
  initialState: { items: [], loading: false, error: null, actionLoading: false },
  reducers: { clearError(state) { state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchProveedores.pending, s => { s.loading=true; s.error=null; })
     .addCase(fetchProveedores.fulfilled, (s,a) => { s.loading=false; s.items=Array.isArray(a.payload)?a.payload.map(norm):[]; })
     .addCase(fetchProveedores.rejected, (s,a) => { s.loading=false; s.error=a.payload; })
     .addCase(createProveedor.pending, s => { s.actionLoading=true; })
     .addCase(createProveedor.fulfilled, (s,a) => { s.actionLoading=false; if(a.payload) s.items.push(norm(a.payload)); })
     .addCase(createProveedor.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(updateProveedor.pending, s => { s.actionLoading=true; })
     .addCase(updateProveedor.fulfilled, (s,a) => { s.actionLoading=false; const n=norm(a.payload||{}); const idx=s.items.findIndex(i=>i.Id_Proveedor===n.Id_Proveedor); if(idx>=0) s.items[idx]=n; })
     .addCase(updateProveedor.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(toggleProveedorEstado.fulfilled, (s,a) => { const item=s.items.find(i=>i.Id_Proveedor===a.payload.id); if(item) item.Estado=normEstado(a.payload.Estado); });
  },
});
export const { clearError } = proveedoresSlice.actions;
export default proveedoresSlice.reducer;
