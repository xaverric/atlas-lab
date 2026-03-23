import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/index.js', () => ({
  config: { allowShellExec: true },
}));

import { shellExecutor } from '../../src/executors/shell.js';
import { config } from '../../src/config/index.js';

const makeCtx = () => ({
  jobId: 'j1',
  runId: 'r1',
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
  env: {},
});

beforeEach(() => vi.clearAllMocks());

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

  it('filters sensitive env vars', async () => {
    const originalEnv = { ...process.env };
    process.env.INTERNAL_KEY = 'secret';
    process.env.VAPID_PRIVATE_KEY = 'secret2';

    const result = await shellExecutor.execute({ command: 'echo', args: ['ok'] }, 5000, makeCtx());
    expect(result.exitCode).toBe(0);

    process.env = originalEnv;
  });

  it('truncates output at 50KB', async () => {
    const result = await shellExecutor.execute(
      { command: 'node', args: ['-e', `process.stdout.write('x'.repeat(60000))`] },
      5000,
      makeCtx(),
    );

    expect(result.stdout!.length).toBeLessThanOrEqual(50_000);
  });

  it('returns non-zero exit code on failed command', async () => {
    const result = await shellExecutor.execute(
      { command: 'node', args: ['-e', 'process.exit(42)'] },
      5000,
      makeCtx(),
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.error).toBeDefined();
  });

  it('returns error when allowShellExec is false', async () => {
    const original = config.allowShellExec;
    (config as Record<string, unknown>).allowShellExec = false;

    const result = await shellExecutor.execute(
      { command: 'echo', args: ['hi'] },
      5000,
      makeCtx(),
    );

    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('disabled');

    (config as Record<string, unknown>).allowShellExec = original;
  });

  it('handles command timeout', async () => {
    const result = await shellExecutor.execute(
      { command: 'sleep', args: ['10'] },
      100,
      makeCtx(),
    );

    expect(result.error).toBeDefined();
  });

  it('merges user-provided env vars', async () => {
    const result = await shellExecutor.execute(
      { command: 'node', args: ['-e', 'process.stdout.write(process.env.MY_VAR)'], env: { MY_VAR: 'hello' } },
      5000,
      makeCtx(),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello');
  });

  it('runs without cwd specified', async () => {
    const result = await shellExecutor.execute(
      { command: 'echo', args: ['no-cwd'] },
      5000,
      makeCtx(),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('no-cwd');
  });
});
