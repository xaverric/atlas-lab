import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'core',
    root: '.',
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
});
