import { execFile } from 'node:child_process';
import { writeFile, unlink, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';
import type { Executor, ExecutionResult, ExecutionContext } from './types.js';

const MAX_OUTPUT = 50_000;

interface GitExecutorConfig {
  operation: 'clone' | 'pull' | 'push' | 'sync';
  repoUrl: string;
  branch?: string;
  sshPrivateKey?: string;
  workDir?: string;
  commitMessage?: string;
  remote?: string;
}

const runGit = (
  args: string[],
  opts: { cwd?: string; env?: Record<string, string>; timeout: number },
): Promise<{ exitCode: number; stdout: string; stderr: string; error?: string }> =>
  new Promise((resolve) => {
    const child = execFile('git', args, {
      timeout: opts.timeout,
      maxBuffer: MAX_OUTPUT * 2,
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
    }, (err, stdout, stderr) => {
      resolve({
        exitCode: child.exitCode ?? (err ? 1 : 0),
        stdout: stdout.slice(0, MAX_OUTPUT),
        stderr: stderr.slice(0, MAX_OUTPUT),
        ...(err ? { error: err.message } : {}),
      });
    });
  });

const setupSshEnv = async (sshPrivateKey: string): Promise<{ env: Record<string, string>; keyPath: string }> => {
  const keyPath = join(tmpdir(), `atlas-git-${randomUUID()}`);
  await writeFile(keyPath, sshPrivateKey, { mode: 0o600 });
  return {
    env: { GIT_SSH_COMMAND: `ssh -i ${keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null` },
    keyPath,
  };
};

const dirExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const gitExecutor: Executor = {
  async execute(cfg, timeoutMs, ctx?: ExecutionContext): Promise<ExecutionResult> {
    if (!config.allowShellExec) {
      ctx?.logger.error('Git execution is disabled (ALLOW_SHELL_EXEC)');
      return { exitCode: 1, error: 'Git execution is disabled. Set ALLOW_SHELL_EXEC=true to enable.' };
    }

    const {
      operation,
      repoUrl,
      branch = 'main',
      sshPrivateKey,
      workDir,
      commitMessage,
      remote = 'origin',
    } = cfg as unknown as GitExecutorConfig;

    ctx?.logger.info(`Git ${operation}: ${repoUrl} (branch: ${branch})`);

    let sshEnv: Record<string, string> = {};
    let keyPath: string | null = null;

    try {
      if (sshPrivateKey) {
        const ssh = await setupSshEnv(sshPrivateKey);
        sshEnv = ssh.env;
        keyPath = ssh.keyPath;
      }

      const gitOpts = (cwd?: string) => ({ cwd, env: sshEnv, timeout: timeoutMs });
      const allStdout: string[] = [];
      const allStderr: string[] = [];
      let lastExitCode = 0;

      const collect = (result: Awaited<ReturnType<typeof runGit>>) => {
        if (result.stdout) allStdout.push(result.stdout);
        if (result.stderr) allStderr.push(result.stderr);
        if (result.stdout) ctx?.logger.info(result.stdout);
        if (result.stderr) ctx?.logger.warn(result.stderr);
        lastExitCode = result.exitCode;
        return result;
      };

      if (operation === 'clone') {
        const targetDir = workDir || join(tmpdir(), `atlas-git-repo-${randomUUID()}`);

        if (await dirExists(join(targetDir, '.git'))) {
          ctx?.logger.info(`Directory ${targetDir} already contains a repo, pulling instead`);
          collect(await runGit(['pull', remote, branch], gitOpts(targetDir)));
        } else {
          await mkdir(targetDir, { recursive: true });
          collect(await runGit(['clone', '-b', branch, repoUrl, targetDir], gitOpts()));
        }
      }

      if (operation === 'pull') {
        if (!workDir) return { exitCode: 1, error: 'workDir is required for pull operation' };
        collect(await runGit(['pull', remote, branch], gitOpts(workDir)));
      }

      if (operation === 'push') {
        if (!workDir) return { exitCode: 1, error: 'workDir is required for push operation' };
        if (commitMessage) {
          collect(await runGit(['add', '-A'], gitOpts(workDir)));
          if (lastExitCode === 0) {
            collect(await runGit(['commit', '-m', commitMessage], gitOpts(workDir)));
          }
        }
        if (lastExitCode === 0 || !commitMessage) {
          collect(await runGit(['push', remote, branch], gitOpts(workDir)));
        }
      }

      if (operation === 'sync') {
        if (!workDir) return { exitCode: 1, error: 'workDir is required for sync operation' };
        const pullResult = collect(await runGit(['pull', remote, branch], gitOpts(workDir)));
        if (pullResult.exitCode === 0) {
          if (commitMessage) {
            collect(await runGit(['add', '-A'], gitOpts(workDir)));
            if (lastExitCode === 0) {
              collect(await runGit(['commit', '-m', commitMessage], gitOpts(workDir)));
            }
          }
          collect(await runGit(['push', remote, branch], gitOpts(workDir)));
        }
      }

      const stdout = allStdout.join('\n').slice(0, MAX_OUTPUT);
      const stderr = allStderr.join('\n').slice(0, MAX_OUTPUT);

      return {
        exitCode: lastExitCode,
        stdout,
        stderr,
        ...(lastExitCode !== 0 ? { error: `Git ${operation} failed with exit code ${lastExitCode}` } : {}),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      ctx?.logger.error(`Git error: ${message}`);
      return { exitCode: 1, error: message };
    } finally {
      if (keyPath) {
        await unlink(keyPath).catch(() => {});
      }
    }
  },
};
