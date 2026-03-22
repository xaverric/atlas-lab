import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/index.js', () => ({
  config: { allowShellExec: true },
}));

import { shellExecutor } from '../../src/executors/shell.js';

describe('shellExecutor', () => {
  it('rejects cwd outside allowed roots', async () => {
    const result = await shellExecutor.execute({ command: 'echo', args: ['hi'], cwd: '/etc/passwd' }, 5000);
    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('not allowed');
  });

  it('allows cwd inside /tmp', async () => {
    const result = await shellExecutor.execute({ command: 'echo', args: ['hello'], cwd: '/tmp' }, 5000);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello');
  });
});
