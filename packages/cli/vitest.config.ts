import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@behavioros/schemas': resolve(__dirname, '../schemas/src'),
      '@behavioros/core': resolve(__dirname, '../core/src'),
      '@behavioros/sdk': resolve(__dirname, '../sdk/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
