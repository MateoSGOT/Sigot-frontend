import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { notificacionesService } from '../services/notificacionesService.js';

/* El contador de no leídas vive en el STORE y no en el estado local de cada
   componente, y es lo que arregla el desajuste real: la campana del Sidebar y
   la página /notificaciones muestran el mismo número, y marcar algo como leído
   en la página tiene que bajar el contador de la campana sin recargar.

   Con estado local en cada uno, los dos piden lo mismo por su cuenta y quedan
   desincronizados en cuanto el usuario toca uno de ellos. */
/* DOS listas, y la separacion no es un capricho:

     items     -- la PAGINA que se esta viendo en /notificaciones. Cambia al
                  pasar de pagina o al cambiar el tamano.
     recientes -- las primeras de la lista, que es lo que pinta la campana.

   Compartian array hasta que la vista gano paginacion, y entonces pasar a la
   pagina 2 reemplazaba `items` y la campana se ponia a mostrar las cinco
   primeras de ESA pagina: cinco alertas del medio del listado, sin relacion con
   "lo mas reciente". Son dos preguntas distintas -- "que pagina estoy mirando" y
   "que hay arriba del todo" -- y cada una necesita su respuesta.

   Las dos salen de la MISMA consulta y el MISMO orden, asi que las 5 de la
   campana siguen siendo la cabeza de la pagina 1: el acceso rapido sigue
   llevando a lo que se ve al entrar.

   Los filtros de la vista (tipo y "sin leer") se aplican en el CLIENTE sobre
   `items`: acotan lo ya traido y no tocan ninguna de las dos listas. El contador
   `noLeidas` viene del servidor, que es quien conoce el total real mas alla de
   la pagina cargada. */
export const PAGE_SIZE = 10;

/* Cuantas trae la campana: 5 para mostrar + 1 para saber si hay mas, sin pedir
   un conteo aparte. El total real lo da igualmente la respuesta. */
export const PREVIO_SIZE = 6;

export const fetchNotificaciones = createAsyncThunk(
  'notificaciones/fetch',
  async ({ page = 1, pageSize = 30, soloNoLeidas = false, tipo = null } = {}, { rejectWithValue }) => {
    try {
      return await notificacionesService.getMias({ page, pageSize, soloNoLeidas, tipo });
    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || 'No se pudieron cargar las notificaciones');
    }
  },
);

/* La campana pide SIEMPRE la primera pagina y escribe en `recientes`, nunca en
   `items`: asi la paginacion de la vista no la arrastra. */
export const fetchRecientes = createAsyncThunk(
  'notificaciones/fetchRecientes',
  async (_, { rejectWithValue }) => {
    try {
      return await notificacionesService.getMias({ page: 1, pageSize: PREVIO_SIZE });
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
  recientes: [],
  total: 0,
  /* Total que ve la campana, sin los filtros de la vista: es lo que decide si
     muestra "Ver mas". */
  totalRecientes: 0,
  /* Conteo por tipo calculado por el SERVIDOR sobre todo el alcance del rol, no
     sobre la pagina: una pastilla que dice "Stock bajo (8)" porque es lo que
     cayo en las 10 filas visibles miente cuando hay 181. */
  porTipo: {},
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
       s.porTipo = a.payload?.porTipo ?? {};
     })
     .addCase(fetchNotificaciones.rejected, (s, a) => { s.loading = false; s.error = a.payload; })

     /* No toca `loading`: la campana carga de fondo y encender el indicador de
        la vista por una peticion que el usuario no pidio haria parpadear la
        lista. Si actualiza `total` y `noLeidas`, que son del servidor. */
     .addCase(fetchRecientes.fulfilled, (s, a) => {
       s.recientes = a.payload?.data || [];
       /* La campana NO pisa `total` ni `porTipo`: los pide sin filtros y la
          vista puede estar filtrada, asi que sobrescribirlos haria saltar el
          subtitulo y las pastillas cada vez que la campana refresca. Solo
          actualiza noLeidas, que es el mismo numero en los dos sitios. */
       s.noLeidas = a.payload?.noLeidas ?? s.noLeidas;
       s.totalRecientes = a.payload?.total ?? s.totalRecientes;
     })

     /* Marcar una se aplica de forma OPTIMISTA, en `pending`: en una lista densa
        se marcan varias seguidas y esperar la ida y vuelta en cada una se siente
        trabado. Si el servidor rechaza, `rejected` lo revierte -- no se recarga
        la lista entera, que perdería el scroll del usuario. */
     /* Se marca en LAS DOS listas: la misma notificacion puede estar en la
        pagina visible y en la vista previa de la campana, y dejar una sin tocar
        la mostraria como no leida justo al lado de la que si lo esta. El
        contador baja UNA vez, no una por lista. */
     .addCase(marcarNotificacionLeida.pending, (s, a) => {
       const estaba = [s.items, s.recientes]
         .map((lista) => lista.find((x) => x.Id === a.meta.arg))
         .filter(Boolean);
       if (estaba.some((n) => !n.Leido)) s.noLeidas = Math.max(0, s.noLeidas - 1);
       estaba.forEach((n) => { n.Leido = true; });
     })
     .addCase(marcarNotificacionLeida.rejected, (s, a) => {
       const estaba = [s.items, s.recientes]
         .map((lista) => lista.find((x) => x.Id === a.meta.arg))
         .filter(Boolean);
       if (estaba.some((n) => n.Leido)) s.noLeidas += 1;
       estaba.forEach((n) => { n.Leido = false; });
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
       s.recientes.forEach((n) => { n.Leido = true; });
       s.noLeidas = 0;
     })
     .addCase(marcarTodasLeidas.rejected, (s, a) => { s.actionLoading = false; s.error = a.payload; });
  },
});

export const { clearError } = slice.actions;
export default slice.reducer;
