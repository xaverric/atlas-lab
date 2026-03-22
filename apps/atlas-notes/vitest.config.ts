import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'atlas-notes',
    root: '.',
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
