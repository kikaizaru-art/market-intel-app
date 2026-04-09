import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  base: './',
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '@': '/src/dashboard',
    },
  },
})
