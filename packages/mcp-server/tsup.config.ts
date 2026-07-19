import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/server.ts'],
    format: ['cjs'],
    outDir: 'dist',
    bundle: true,
    platform: 'node',
    target: 'node22',
    noExternal: [/@behavioros\//, /@modelcontextprotocol\//, /zod/, /ajv/],
    sourcemap: false,
    minify: false,
  },
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    outDir: 'dist',
    bundle: true,
    platform: 'node',
    target: 'node22',
    noExternal: [/@behavioros\//, /@modelcontextprotocol\//, /zod/, /ajv/],
    sourcemap: false,
    minify: false,
  },
]);
