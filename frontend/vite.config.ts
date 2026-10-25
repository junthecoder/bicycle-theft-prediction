import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The backend (`uv run api` in backend/) serves the data and the PMTiles basemap on port 8000.
const backend = 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // maplibre-gl loads its worker with `new URL(..., import.meta.url)`, which breaks once Vite
  // pre-bundles the package into node_modules/.vite/deps ("Worker failed to load").
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  server: {
    proxy: {
      '/api': backend,
      '/tiles': backend,
    },
  },
})
