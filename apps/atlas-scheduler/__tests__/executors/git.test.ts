import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/index.js', () => ({
  config: { allowShellExec: true },
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockRejectedValue(new Error('ENOENT')),
}));

import { gitExecutor } from '../../src/executors/git.js';
import { execFile } from 'node:child_process';
import { config } from '../../src/config/index.js';

const mockExecFile = vi.mocked(execFile);

beforeEach(() => vi.clearAllMocks());

const makeCtx = () => ({
  jobId: 'j1',
  runId: 'r1',
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
  env: {},
});

const mockGitSuccess = (stdout = '', stderr = '') => {
  mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
    const child = { exitCode: 0 };
    queueMicrotask(() => (cb as (...args: unknown[]) => void)(null, stdout, stderr));
    return child as never;
  });
};

const mockGitFailure = (errorMsg: string, stderr = '') => {
  mockExecFile.mockImplementation((_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
    const child = { exitCode: 1 };
    queueMicrotask(() => (cb as (...args: unknown[]) => void)(new Error(errorMsg), '', stderr));
    return child as never;
  });
};

describe('gitExecutor', () => {
  it('executes clone operation', async () => {
    mockGitSuccess('Cloning into...');

    const result = await gitExecutor.execute(
      { operation: 'clone', repoUrl: 'https://github.com/test/repo.git', branch: 'main' },
      30000,
      makeCtx(),
    );

    expect(result.exitCode).toBe(0);
    expect(mockExecFile).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['clone', '-b', 'main', 'https://github.com/test/repo.git']),
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('executes pull operation', async () => {
    mockGitSuccess('Already up to date.');

    const result = await gitExecutor.execute(
      { operation: 'pull', repoUrl: 'https://github.com/test/repo.git', workDir: '/tmp/repo' },
      30000,
      makeCtx(),
    );

    expect(result.exitCode).toBe(0);
    expect(mockExecFile).toHaveBeenCalledWith(
      'git',
      ['pull', 'origin', 'main'],
      expect.objectContaining({ cwd: '/tmp/repo' }),
      expect.any(Function),
    );
  });

  it('returns error when pull has no workDir', async () => {
    const result = await gitExecutor.execute(
      { operation: 'pull', repoUrl: 'https://github.com/test/repo.git' },
      30000,
      makeCtx(),
    );

    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('workDir is required');
  });

  it('returns error when push has no workDir', async () => {
    const result = await gitExecutor.execute(
      { operation: 'push', repoUrl: 'https://github.com/test/repo.git' },
      30000,
      makeCtx(),
    );

    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('workDir is required');
  });

  it('returns error when sync has no workDir', async () => {
    const result = await gitExecutor.execute(
      { operation: 'sync', repoUrl: 'https://github.com/test/repo.git' },
      30000,
      makeCtx(),
    );

    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('workDir is required');
  });

  it('handles git clone failure', async () => {
    mockGitFailure('fatal: repository not found', 'fatal: repository not found');

    const result = await gitExecutor.execute(
      { operation: 'clone', repoUrl: 'https://github.com/test/missing.git' },
      30000,
      makeCtx(),
    );

    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('Git clone failed');
  });

  it('uses custom remote', async () => {
    mockGitSuccess('ok');

    await gitExecutor.execute(
      { operation: 'pull', repoUrl: 'https://github.com/test/repo.git', workDir: '/tmp/repo', remote: 'upstream' },
      30000,
      makeCtx(),
    );

    expect(mockExecFile).toHaveBeenCalledWith(
      'git',
      ['pull', 'upstream', 'main'],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('returns error when allowShellExec is false', async () => {
    const original = config.allowShellExec;
    (config as Record<string, unknown>).allowShellExec = false;

    const result = await gitExecutor.execute(
      { operation: 'clone', repoUrl: 'https://github.com/test/repo.git' },
      30000,
      makeCtx(),
    );

    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('disabled');

    (config as Record<string, unknown>).allowShellExec = original;
  });

  it('sets up SSH env when sshPrivateKey provided', async () => {
    mockGitSuccess('Cloning...');

    await gitExecutor.execute(
      { operation: 'clone', repoUrl: 'git@github.com:test/repo.git', sshPrivateKey: 'PRIVATE_KEY_CONTENT' },
      30000,
      makeCtx(),
    );

    expect(mockExecFile).toHaveBeenCalledWith(
      'git',
      expect.any(Array),
      expect.objectContaining({
        env: expect.objectContaining({
          GIT_SSH_COMMAND: expect.stringContaining('ssh -i'),
        }),
      }),
      expect.any(Function),
    );
  });
});
