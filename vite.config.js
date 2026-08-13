import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, forward /api and /healthz to the Express server (run `npm start` in a
// second terminal, or use the combined flow in the README).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': 'http://localhost:3000',
      '/healthz': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
