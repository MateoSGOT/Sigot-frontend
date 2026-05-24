import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { empleadosService } from '../services/empleadosService.js';

const normEstado = (v) => v === true ? 1 : v === false ? 0 : Number(v);
const norm = (e) => ({ ...e, Id_Empleado: e.id_empleado ?? e.Id_Empleado, Estado: normEstado(e.Estado) });

export const fetchEmpleados = createAsyncThunk('empleados/fetchAll', async (_, { rejectWithValue }) => {
  try { const r = await empleadosService.getAll(); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const createEmpleado = createAsyncThunk('empleados/create', async (data, { rejectWithValue }) => {
  try { const r = await empleadosService.create(data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const updateEmpleado = createAsyncThunk('empleados/update', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await empleadosService.update(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const toggleEmpleadoEstado = createAsyncThunk('empleados/toggleEstado', async ({ id, Estado }, { rejectWithValue }) => {
  try { await empleadosService.toggleEstado(id, Estado); return { id, Estado }; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
const empleadosSlice = createSlice({
  name: 'empleados',
  initialState: { items: [], loading: false, error: null, actionLoading: false },
  reducers: { clearError(state) { state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchEmpleados.pending, s => { s.loading=true; s.error=null; })
     .addCase(fetchEmpleados.fulfilled, (s,a) => { s.loading=false; s.items=Array.isArray(a.payload)?a.payload.map(norm):[]; })
     .addCase(fetchEmpleados.rejected, (s,a) => { s.loading=false; s.error=a.payload; })
     .addCase(createEmpleado.pending, s => { s.actionLoading=true; })
     .addCase(createEmpleado.fulfilled, (s,a) => { s.actionLoading=false; if(a.payload) s.items.push(norm(a.payload)); })
     .addCase(createEmpleado.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(updateEmpleado.pending, s => { s.actionLoading=true; })
     .addCase(updateEmpleado.fulfilled, (s,a) => { s.actionLoading=false; const n=norm(a.payload||{}); const idx=s.items.findIndex(i=>i.Id_Empleado===n.Id_Empleado); if(idx>=0) s.items[idx]=n; })
     .addCase(updateEmpleado.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(toggleEmpleadoEstado.fulfilled, (s,a) => { const item=s.items.find(i=>i.Id_Empleado===a.payload.id); if(item) item.Estado=normEstado(a.payload.Estado); });
  },
});
export const { clearError } = empleadosSlice.actions;
export default empleadosSlice.reducer;
