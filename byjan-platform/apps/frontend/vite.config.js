import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    pool: 'threads',
    fileParallelism: false,
    isolate: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 30000,
  },
});
