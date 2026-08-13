import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During local dev we proxy nothing — Supabase is called directly from the browser.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
