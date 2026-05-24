import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authService } from '../services/authService.js';
import { TOKEN_KEY } from '../../../shared/services/api.js';
import api from '../../../shared/services/api.js';

export const fetchUserPermisos = createAsyncThunk('auth/fetchPermisos', async (id_rol) => {
  try {
    const r = await api.get(`/api/permisos/rol/${id_rol}/nombres`);
    return Array.isArray(r.data?.data) ? r.data.data : [];
  } catch {
    return [];
  }
});

const storedToken = localStorage.getItem(TOKEN_KEY);

export const loginThunk = createAsyncThunk('auth/login', async ({ Correo, Password }, { rejectWithValue }) => {
  try {
    const data = await authService.login(Correo, Password);
    return data;
  } catch (err) {
    return rejectWithValue(err?.response?.data?.message || 'Credenciales inválidas');
  }
});

// Called on app startup when there is a stored token but no empleado in memory.
// Validates the token and restores the empleado object.
export const restoreSession = createAsyncThunk('auth/restore', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/api/auth/me');
    return response.data;
  } catch (err) {
    return rejectWithValue(err?.response?.data?.message || 'Sesión inválida');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: storedToken || null,
    empleado: null,
    cliente: null,
    tipo: null,
    permisos: null,  // null = no cargado, [] = cargado sin permisos, [...] = lista de nombres
    loading: false,
    restoring: !!storedToken,
    error: null,
  },
  reducers: {
    logout(state) {
      state.token = null;
      state.empleado = null;
      state.cliente = null;
      state.tipo = null;
      state.permisos = null;
      state.restoring = false;
      localStorage.removeItem(TOKEN_KEY);
      authService.logout().catch(() => {});
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload.data || action.payload;
        state.token = payload.token;
        state.tipo = payload.tipo;
        state.empleado = payload.empleado || null;
        state.cliente = payload.cliente || null;
        state.restoring = false;
        localStorage.setItem(TOKEN_KEY, payload.token);
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Restore session
      .addCase(restoreSession.fulfilled, (state, action) => {
        const empleado = action.payload.data || action.payload;
        state.empleado = empleado;
        state.tipo = 'empleado';
        state.restoring = false;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.token = null;
        state.empleado = null;
        state.cliente = null;
        state.tipo = null;
        state.permisos = null;
        state.restoring = false;
        localStorage.removeItem(TOKEN_KEY);
      })
      // Permisos del usuario logueado
      .addCase(fetchUserPermisos.fulfilled, (state, action) => {
        state.permisos = action.payload;
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
