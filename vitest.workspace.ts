import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/atlas-core/vitest.config.ts',
  'apps/atlas-dms/vitest.config.ts',
  'apps/atlas-scheduler/vitest.config.ts',
  'apps/atlas-notify/vitest.config.ts',
  'apps/atlas-notes/vitest.config.ts',
  'apps/atlas-tracker/vitest.config.ts',
  'packages/core/vitest.config.ts',
  'packages/server-common/vitest.config.ts',
  'packages/event-bus/vitest.config.ts',
]);
