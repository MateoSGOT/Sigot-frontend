import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Tailwind v4 va como plugin de Vite (ya no por PostCSS, ni con
  // tailwind.config.js): la configuracion del tema vive en CSS, dentro del
  // bloque @theme de shared/styles/tailwind.css.
  plugins: [react(), tailwindcss()],
  build: { charset: 'utf8' },
})
