import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 0 },
  worker: { format: 'es' },
  test: { include: ['tests/**/*.test.ts'] },
} as never);
