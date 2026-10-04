import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { store } from './store/index.js';
import { ToastProvider } from './shared/components/Toast/ToastContext.jsx';
import App from './App.jsx';
// globals.css primero: declara los tokens en :root y el reset propio del
// proyecto. tailwind.css despues, para que su @theme se sume a esos tokens.
import './shared/styles/globals.css';
import './shared/styles/tailwind.css';

/* TanStack Query: solo la infraestructura.

   Redux Toolkit SIGUE siendo la capa de datos de las ~17 paginas del panel
   (slices + thunks + servicios). Este provider no cambia ninguna de ellas: deja
   disponible useQuery para las vistas que se vayan migrando, sin convertir el
   proyecto en dos paradigmas de datos de golpe.

   staleTime alto a proposito: el plan gratuito de Render duerme el servicio y el
   primer pedido despues de ~15 min paga arranque en frio (medido: 21.8 s). Con
   refetch agresivo, cada vuelta a una pestana dispararia ese costo otra vez.
   retry en 1: si la API esta dormida, reintentar tres veces solo alarga la
   espera sin cambiar el resultado. */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        {/* reducedMotion="user" hace que TODOS los componentes de Motion
            respeten la preferencia del sistema. Hace falta explícitamente: la
            regla @media (prefers-reduced-motion) de globals.css solo apaga
            animaciones y transiciones CSS, y las de Motion son JS -- seguirían
            corriendo para alguien que pidió menos movimiento. Con esto, Motion
            desactiva transform y layout, y deja pasar solo la opacidad. */}
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <ToastProvider>
              <App />
            </ToastProvider>
          </BrowserRouter>
        </MotionConfig>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>
);
