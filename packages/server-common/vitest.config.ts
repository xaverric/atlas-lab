import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'server-common',
    root: '.',
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
