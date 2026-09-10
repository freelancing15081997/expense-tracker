import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    envPrefix: ['VITE_', 'NEON_'],
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    preview: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
        '/neondb/auth': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
