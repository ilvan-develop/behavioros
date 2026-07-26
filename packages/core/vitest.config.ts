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
      provider: 'istanbul',
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
    },
  },
  bench: {
    include: ['src/**/*.bench.ts'],
  },
});
