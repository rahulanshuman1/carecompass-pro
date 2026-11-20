import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: the browser calls /api/v1/* on the Vite server, which proxies to the local API (same-origin, so cookies just work).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': { target: process.env.VITE_DEV_API || 'http://localhost:8080', changeOrigin: true } } },
  build: { sourcemap: false, target: 'es2020' },
});
