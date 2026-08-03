import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 10_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      // Measured baseline (2026-08-03): ~34% lines/statements, ~74% functions, ~71% branches.
      // Much lower than @behavioros/core because server.ts's 900+ lines of tool registration
      // and most of src/tools/*.ts are only exercised indirectly via contract/e2e tests, not
      // unit tests. Thresholds are set to the honest current floor (previously there was no
      // coverage config here at all) rather than an aspirational number — raise these as
      // real unit coverage for server.ts/tools/* improves.
      thresholds: {
        lines: 30,
        statements: 30,
        functions: 65,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@behavioros/schemas': resolve(__dirname, '../schemas/src/index.ts'),
      '@behavioros/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
