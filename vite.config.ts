import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 1800,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
