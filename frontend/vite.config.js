import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { join } from 'path'
import { homedir } from 'os'

export default defineConfig({
  plugins: [react()],
  cacheDir: join(homedir(), '.cache', 'vite', 'parcelflow'),
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/auth':        {target: "http://127.0.0.1:8000", changeOrigin: true },
      '/parcels':     { target: "http://127.0.0.1:8000", changeOrigin: true },
      '/rules':       {target: "http://127.0.0.1:8000", changeOrigin: true },
      '/dashboard':   { target: "http://127.0.0.1:8000", changeOrigin: true },
      '/admin/users': { target: "http://127.0.0.1:8000", changeOrigin: true },
      '/users':       { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
})
