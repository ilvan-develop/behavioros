import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@behavioros/schemas': resolve(__dirname, '../schemas/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    include: ['src/**/*.test.ts'],
    coverage: {
      // 'istanbul' was configured here but @vitest/coverage-istanbul was never installed —
      // `vitest run --coverage` failed outright with MISSING DEPENDENCY. @vitest/coverage-v8
      // is the one actually present in this workspace's lockfile, so that's what runs.
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.interface.ts',
        'src/**/interfaces.ts',
        'src/**/types.ts',
        'src/**/bus.ts',
        'src/**/handlers.ts',
        'src/index.reexport.ts',
        'src/index.ts',
        'src/engines/governance/ai-governance.ts',
        'src/engines/governance/compliance/provider.ts',
        'src/cqrs/interfaces.ts',
        'src/cqrs/index.ts',
        'src/persistence/index.ts',
        'src/engines/execution/index.ts',
        'src/engines/ai-platform/index.ts',
        'src/engines/learning/index.ts',
        'src/engines/mission/index.ts',
        'src/engines/observability/index.ts',
        'src/engines/quality/index.ts',
        'src/engines/intelligence/index.ts',
        'src/engines/behavioral/audit-chain/index.ts',
        'src/domain/anti-corruption/index.ts',
        'src/domain/boundaries/index.ts',
        'src/domain/contexts/index.ts',
        'src/kernel/storage/index.ts',
        'src/mesh/index.ts',
        'src/pipeline/telemetry/index.ts',
      ],
      excludeAfterRemap: true,
      // Measured baseline (2026-08-03): ~95% lines/statements, ~97% functions, ~89% branches.
      // Thresholds set a few points below baseline so normal work has headroom without
      // coverage silently regressing — previously this was measured but never enforced.
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 80,
      },
    },
  },
  bench: {
    include: ['src/**/*.bench.ts'],
  },
});
