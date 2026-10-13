import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { notificacionesService } from '../services/notificacionesService.js';

/* El contador de no leídas vive en el STORE y no en el estado local de cada
   componente, y es lo que arregla el desajuste real: la campana del Sidebar y
   la página /notificaciones muestran el mismo número, y marcar algo como leído
   en la página tiene que bajar el contador de la campana sin recargar.

   Con estado local en cada uno, los dos piden lo mismo por su cuenta y quedan
   desincronizados en cuanto el usuario toca uno de ellos. */
/* UNA sola lista en el store, sin filtrar, y un solo tamano de pagina.
   La campana es el acceso rapido a /notificaciones: lo que muestra tienen que
   ser las MISMAS cinco primeras de esa lista. Si la pagina recargara con un
   filtro aplicado (p. ej. "sin leer"), reemplazaria `items` y la campana pasaria
   a mostrar un subconjunto distinto de lo que el usuario cree estar viendo.

   Por eso el filtro de no leidas se aplica en el CLIENTE, igual que el de tipo:
   los dos acotan lo ya traido y ninguno toca la lista canonica. El contador
   `noLeidas` sigue viniendo del servidor, que es quien sabe el total real. */
export const PAGE_SIZE = 50;

export const fetchNotificaciones = createAsyncThunk(
  'notificaciones/fetch',
  async ({ page = 1, pageSize = 30, soloNoLeidas = false } = {}, { rejectWithValue }) => {
    try {
      return await notificacionesService.getMias({ page, pageSize, soloNoLeidas });
    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || 'No se pudieron cargar las notificaciones');
    }
  },
);

export const marcarNotificacionLeida = createAsyncThunk(
  'notificaciones/marcarLeida',
  async (id, { rejectWithValue }) => {
    try {
      await notificacionesService.marcarLeida(id);
      return id;
    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || 'No se pudo marcar como leída');
    }
  },
);

export const marcarTodasLeidas = createAsyncThunk(
  'notificaciones/marcarTodas',
  async (_, { rejectWithValue }) => {
    try {
      const r = await notificacionesService.marcarTodasLeidas();
      return r?.data?.cambiadas ?? 0;
    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || 'No se pudo marcar el lote');
    }
  },
);

const initialState = {
  items: [],
  total: 0,
  noLeidas: 0,
  loading: false,
  actionLoading: false,
  error: null,
};

const slice = createSlice({
  name: 'notificaciones',
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
  },
  extraReducers: (b) => {
    b.addCase(fetchNotificaciones.pending, (s) => { s.loading = true; s.error = null; })
     .addCase(fetchNotificaciones.fulfilled, (s, a) => {
       s.loading = false;
       s.items = a.payload?.data || [];
       s.total = a.payload?.total ?? 0;
       s.noLeidas = a.payload?.noLeidas ?? 0;
     })
     .addCase(fetchNotificaciones.rejected, (s, a) => { s.loading = false; s.error = a.payload; })

     /* Marcar una se aplica de forma OPTIMISTA, en `pending`: en una lista densa
        se marcan varias seguidas y esperar la ida y vuelta en cada una se siente
        trabado. Si el servidor rechaza, `rejected` lo revierte -- no se recarga
        la lista entera, que perdería el scroll del usuario. */
     .addCase(marcarNotificacionLeida.pending, (s, a) => {
       const n = s.items.find((x) => x.Id === a.meta.arg);
       if (n && !n.Leido) { n.Leido = true; s.noLeidas = Math.max(0, s.noLeidas - 1); }
     })
     .addCase(marcarNotificacionLeida.rejected, (s, a) => {
       const n = s.items.find((x) => x.Id === a.meta.arg);
       if (n && n.Leido) { n.Leido = false; s.noLeidas += 1; }
       s.error = a.payload;
     })

     .addCase(marcarTodasLeidas.pending, (s) => { s.actionLoading = true; })
     /* Aquí NO es optimista: el servidor decide cuántas cambió (solo las del
        lote que ese rol ve) y ese número se muestra al usuario. Adelantarlo en
        el cliente obligaría a adivinarlo y podría decir "12" cuando cambiaron 8. */
     .addCase(marcarTodasLeidas.fulfilled, (s, a) => {
       s.actionLoading = false;
       s.cambiadas = a.payload;
       s.items.forEach((n) => { n.Leido = true; });
       s.noLeidas = 0;
     })
     .addCase(marcarTodasLeidas.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload; });
  },
});

export const { clearError } = slice.actions;
export default slice.reducer;
