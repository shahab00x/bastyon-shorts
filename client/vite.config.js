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
      }
    },
    allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0', 'localhost:3030', 'apptest.bastyon.ir'] 
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
})
