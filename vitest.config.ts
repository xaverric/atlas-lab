import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      exclude: [
        '**/index.ts',
        '**/config/**',
        '**/models/**',
        '**/routes/**',
        '**/controllers/**',
        '**/daos/**',
        '**/workers/**',
        '**/migrations/**',
        'apps/atlas-gui/**',
        'apps/atlas-mcp/**',
        'deployment/**',
      ],
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
