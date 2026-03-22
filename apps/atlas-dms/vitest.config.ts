import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'atlas-dms',
    root: '.',
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
