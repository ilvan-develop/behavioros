import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 10_000,
  },
  resolve: {
    alias: {
      '@behavioros/schemas': resolve(__dirname, '../schemas/src/index.ts'),
      '@behavioros/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
