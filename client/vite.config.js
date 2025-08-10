import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3333,
    proxy: {
      '/api': {
        target: 'http://localhost:3030',
        changeOrigin: true,
        secure: false
      },
      '/playlists': {
        target: 'http://localhost:3030',
        changeOrigin: true,
        secure: false
      }
    },
    allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0', 'localhost:3333', 'apptest.bastyon.ir'],
    headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
})
