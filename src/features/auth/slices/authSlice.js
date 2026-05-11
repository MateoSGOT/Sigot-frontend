import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authService } from '../services/authService.js';
import { TOKEN_KEY } from '../../../shared/services/api.js';
import api from '../../../shared/services/api.js';

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
    loading: false,
    restoring: !!storedToken, // true while we verify the stored token
    error: null,
  },
  reducers: {
    logout(state) {
      state.token = null;
      state.empleado = null;
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
        const { token, empleado } = action.payload.data || action.payload;
        state.token = token;
        state.empleado = empleado;
        state.restoring = false;
        localStorage.setItem(TOKEN_KEY, token);
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Restore session
      .addCase(restoreSession.fulfilled, (state, action) => {
        const empleado = action.payload.data || action.payload;
        state.empleado = empleado;
        state.restoring = false;
      })
      .addCase(restoreSession.rejected, (state) => {
        // Token is invalid — clear everything and force login
        state.token = null;
        state.empleado = null;
        state.restoring = false;
        localStorage.removeItem(TOKEN_KEY);
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
