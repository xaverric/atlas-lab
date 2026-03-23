import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
  spawn: vi.fn(),
}));

import { execFileSync, spawn } from 'node:child_process';

const mockExecFileSync = vi.mocked(execFileSync);
const _mockSpawn = vi.mocked(spawn);

beforeEach(() => vi.clearAllMocks());

const makeCtx = () => ({
  jobId: 'j1',
  runId: 'r1',
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
  env: {},
});

const createMockProc = () => {
  const proc = new EventEmitter() as EventEmitter & {
    stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc;
};

describe('javascriptExecutor', () => {
  it('returns error when Docker is not available', async () => {
    mockExecFileSync.mockImplementation(() => { throw new Error('not found'); });

    vi.resetModules();
    vi.doMock('node:child_process', () => ({
      execFileSync: () => { throw new Error('not found'); },
      spawn: vi.fn(),
    }));

    const { javascriptExecutor } = await import('../../src/executors/javascript.js');
    const ctx = makeCtx();

    const result = await javascriptExecutor.execute({ code: 'console.log("hi")' }, 5000, ctx);
    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('Docker');
  });

  it('spawns Docker with correct security flags on success', async () => {
    vi.resetModules();

    const proc = createMockProc();
    vi.doMock('node:child_process', () => ({
      execFileSync: () => 'ok',
      spawn: vi.fn(() => proc),
    }));

    const { javascriptExecutor } = await import('../../src/executors/javascript.js');
    const ctx = makeCtx();

    const promise = javascriptExecutor.execute({ code: 'return 42' }, 5000, ctx);
    proc.stdout.emit('data', Buffer.from(JSON.stringify({ stdout: 'hello', data: 42 })));
    proc.emit('close', 0);

    const result = await promise;
    expect(result.stdout).toBe('hello');
    expect(result.data).toBe(42);
    expect(result.exitCode).toBeUndefined();
  });

  it('handles container error output', async () => {
    vi.resetModules();

    const proc = createMockProc();
    vi.doMock('node:child_process', () => ({
      execFileSync: () => 'ok',
      spawn: vi.fn(() => proc),
    }));

    const { javascriptExecutor } = await import('../../src/executors/javascript.js');

    const promise = javascriptExecutor.execute({ code: 'throw new Error("boom")' }, 5000, makeCtx());
    proc.stdout.emit('data', Buffer.from(JSON.stringify({ stdout: 'log', error: 'boom' })));
    proc.emit('close', 1);

    const result = await promise;
    expect(result.exitCode).toBe(1);
    expect(result.error).toBe('boom');
  });

  it('handles non-JSON container output (crash)', async () => {
    vi.resetModules();

    const proc = createMockProc();
    vi.doMock('node:child_process', () => ({
      execFileSync: () => 'ok',
      spawn: vi.fn(() => proc),
    }));

    const { javascriptExecutor } = await import('../../src/executors/javascript.js');

    const promise = javascriptExecutor.execute({ code: '' }, 5000, makeCtx());
    proc.stderr.emit('data', Buffer.from('Segfault'));
    proc.emit('close', 137);

    const result = await promise;
    expect(result.exitCode).toBe(137);
    expect(result.stderr).toContain('Segfault');
  });

  it('truncates output at 50KB', async () => {
    vi.resetModules();

    const proc = createMockProc();
    vi.doMock('node:child_process', () => ({
      execFileSync: () => 'ok',
      spawn: vi.fn(() => proc),
    }));

    const { javascriptExecutor } = await import('../../src/executors/javascript.js');

    const promise = javascriptExecutor.execute({ code: '' }, 5000, makeCtx());
    proc.stdout.emit('data', Buffer.from('x'.repeat(60_000)));
    proc.emit('close', 1);

    const result = await promise;
    expect(result.stdout!.length).toBeLessThanOrEqual(50_000);
  });
});
