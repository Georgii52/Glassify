import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Админка за nginx по пути /admin/
  base: '/admin/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy /expanse.json and assets from the 8th Wall dev server
      '/expanse.json': 'http://localhost:8080',
      '/assets':       'http://localhost:8080',
    },
  },
})
