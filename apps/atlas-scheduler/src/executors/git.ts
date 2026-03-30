import { execFile } from 'node:child_process';
import { writeFile, unlink, mkdir, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';
import type { Executor, ExecutionResult, ExecutionContext } from './types.js';

const MAX_OUTPUT = 50_000;
const ALLOWED_WORKDIR_ROOTS = ['/tmp', '/home', '/app'];

interface GitExecutorConfig {
  operation: 'clone' | 'pull' | 'push' | 'sync';
  repoUrl: string;
  branch?: string;
  sshPrivateKey?: string;
  workDir?: string;
  commitMessage?: string;
  remote?: string;
}

type GitRunResult = Awaited<ReturnType<typeof runGit>>;

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
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- generated tmp path inside OS temp dir
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

const isAllowedWorkDir = (path: string): boolean => {
  const resolved = resolve(path);
  return ALLOWED_WORKDIR_ROOTS.some((root) => resolved === root || resolved.startsWith(`${root}/`));
};

const requireWorkDir = (workDir: string | undefined, operation: 'pull' | 'push' | 'sync'): string => {
  if (!workDir) {
    throw new Error(`workDir is required for ${operation} operation`);
  }
  return workDir;
};

const runClone = async (
  repoUrl: string,
  branch: string,
  remote: string,
  workDir: string | undefined,
  gitOpts: (cwd?: string) => { cwd?: string; env?: Record<string, string>; timeout: number },
  collect: (result: GitRunResult) => GitRunResult,
  ctx?: ExecutionContext,
) => {
  const targetDir = workDir || join(tmpdir(), `atlas-git-repo-${randomUUID()}`);

  if (await dirExists(join(targetDir, '.git'))) {
    ctx?.logger.info(`Directory ${targetDir} already contains a repo, pulling instead`);
    collect(await runGit(['pull', remote, branch], gitOpts(targetDir)));
    return;
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- validated workDir or generated tmp path
  await mkdir(targetDir, { recursive: true });
  collect(await runGit(['clone', '-b', branch, repoUrl, targetDir], gitOpts()));
};

const runPull = async (
  branch: string,
  remote: string,
  workDir: string | undefined,
  gitOpts: (cwd?: string) => { cwd?: string; env?: Record<string, string>; timeout: number },
  collect: (result: GitRunResult) => GitRunResult,
) => {
  collect(await runGit(['pull', remote, branch], gitOpts(requireWorkDir(workDir, 'pull'))));
};

const runPush = async (
  branch: string,
  remote: string,
  workDir: string | undefined,
  commitMessage: string | undefined,
  gitOpts: (cwd?: string) => { cwd?: string; env?: Record<string, string>; timeout: number },
  collect: (result: GitRunResult) => GitRunResult,
) => {
  const cwd = requireWorkDir(workDir, 'push');

  if (commitMessage) {
    const addResult = collect(await runGit(['add', '-A'], gitOpts(cwd)));
    if (addResult.exitCode === 0) {
      const commitResult = collect(await runGit(['commit', '-m', commitMessage], gitOpts(cwd)));
      if (commitResult.exitCode !== 0) return;
    } else {
      return;
    }
  }

  collect(await runGit(['push', remote, branch], gitOpts(cwd)));
};

const runSync = async (
  branch: string,
  remote: string,
  workDir: string | undefined,
  commitMessage: string | undefined,
  gitOpts: (cwd?: string) => { cwd?: string; env?: Record<string, string>; timeout: number },
  collect: (result: GitRunResult) => GitRunResult,
) => {
  const cwd = requireWorkDir(workDir, 'sync');
  const pullResult = collect(await runGit(['pull', remote, branch], gitOpts(cwd)));
  if (pullResult.exitCode !== 0) return;

  if (commitMessage) {
    const addResult = collect(await runGit(['add', '-A'], gitOpts(cwd)));
    if (addResult.exitCode !== 0) return;

    const commitResult = collect(await runGit(['commit', '-m', commitMessage], gitOpts(cwd)));
    if (commitResult.exitCode !== 0) return;
  }

  collect(await runGit(['push', remote, branch], gitOpts(cwd)));
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

    if (workDir && !isAllowedWorkDir(workDir)) {
      const error = `Working directory "${workDir}" is not allowed. Allowed: ${ALLOWED_WORKDIR_ROOTS.join(', ')}`;
      ctx?.logger.error(error);
      return { exitCode: 1, error };
    }

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

      switch (operation) {
        case 'clone':
          await runClone(repoUrl, branch, remote, workDir, gitOpts, collect, ctx);
          break;
        case 'pull':
          await runPull(branch, remote, workDir, gitOpts, collect);
          break;
        case 'push':
          await runPush(branch, remote, workDir, commitMessage, gitOpts, collect);
          break;
        case 'sync':
          await runSync(branch, remote, workDir, commitMessage, gitOpts, collect);
          break;
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
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- generated tmp path inside OS temp dir
        await unlink(keyPath).catch(() => {});
      }
    }
  },
};
