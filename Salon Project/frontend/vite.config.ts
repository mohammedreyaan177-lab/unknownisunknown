import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend (Express, port 3000) ships no CORS middleware, so the app talks to
// it same-origin through this proxy. VITE_API_BASE stays a relative path.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
