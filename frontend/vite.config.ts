import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Los GeoJSON versionados viven en data/geography/ (raíz del repositorio),
  // fuera de frontend/. El servidor de desarrollo debe poder leerlos.
  server: { fs: { allow: ['..'] } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          graph: ['@xyflow/react'],
          map: ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
})
