import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api is proxied to the deployed Vercel API so the web preview behaves like the app.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_API_URL || 'https://www.easypado.com', changeOrigin: true, secure: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false, target: 'es2020' },
});
