import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@behavioros/schemas': resolve(__dirname, '../schemas/src/index.ts'),
      '@behavioros/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
})
