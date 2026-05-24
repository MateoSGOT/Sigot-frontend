import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { vehiculosService } from '../services/vehiculosService.js';

const normEstado = (v) => v === true ? 1 : v === false ? 0 : Number(v);
const norm = (item) => ({ ...item, Estado: normEstado(item.Estado) });

export const fetchVehiculos = createAsyncThunk('vehiculos/fetchAll', async (_, { rejectWithValue }) => {
  try { const r = await vehiculosService.getAll(); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const createVehiculo = createAsyncThunk('vehiculos/create', async (data, { rejectWithValue }) => {
  try { const r = await vehiculosService.create(data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const updateVehiculo = createAsyncThunk('vehiculos/update', async ({ id, data }, { rejectWithValue }) => {
  try { const r = await vehiculosService.update(id, data); return r.data || r; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});
export const toggleVehiculoEstado = createAsyncThunk('vehiculos/toggleEstado', async ({ id, Estado }, { rejectWithValue }) => {
  try { await vehiculosService.toggleEstado(id, Estado); return { id, Estado }; }
  catch (e) { return rejectWithValue(e?.response?.data?.message || 'Error'); }
});

const vehiculosSlice = createSlice({
  name: 'vehiculos',
  initialState: { items: [], loading: false, error: null, actionLoading: false },
  reducers: { clearError(state) { state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchVehiculos.pending, s => { s.loading=true; s.error=null; })
     .addCase(fetchVehiculos.fulfilled, (s,a) => { s.loading=false; s.items=Array.isArray(a.payload)?a.payload.map(norm):[]; })
     .addCase(fetchVehiculos.rejected, (s,a) => { s.loading=false; s.error=a.payload; })
     .addCase(createVehiculo.pending, s => { s.actionLoading=true; })
     .addCase(createVehiculo.fulfilled, (s,a) => { s.actionLoading=false; if(a.payload) s.items.push(norm(a.payload)); })
     .addCase(createVehiculo.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(updateVehiculo.pending, s => { s.actionLoading=true; })
     .addCase(updateVehiculo.fulfilled, (s,a) => { s.actionLoading=false; const n=norm(a.payload||{}); const idx=s.items.findIndex(i=>i.Id_Vehiculo===n.Id_Vehiculo); if(idx>=0) s.items[idx]=n; })
     .addCase(updateVehiculo.rejected, (s,a) => { s.actionLoading=false; s.error=a.payload; })
     .addCase(toggleVehiculoEstado.fulfilled, (s,a) => { const item=s.items.find(i=>i.Id_Vehiculo===a.payload.id); if(item) item.Estado=normEstado(a.payload.Estado); });
  },
});
export const { clearError } = vehiculosSlice.actions;
export default vehiculosSlice.reducer;
