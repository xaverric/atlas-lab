import { execFile } from 'node:child_process';
import { config } from '../config/index.js';
import type { Executor, ExecutionResult, ExecutionContext } from './types.js';

const MAX_OUTPUT = 50_000;

interface ShellConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export const shellExecutor: Executor = {
  execute(cfg, timeoutMs, ctx?: ExecutionContext): Promise<ExecutionResult> {
    if (!config.allowShellExec) {
      ctx?.logger.error('Shell execution is disabled (ALLOW_SHELL_EXEC)');
      return Promise.resolve({ exitCode: 1, error: 'Shell execution is disabled. Set ALLOW_SHELL_EXEC=true to enable.' });
    }

    const { command, args = [], cwd, env = {} } = cfg as unknown as ShellConfig;

    ctx?.logger.info(`Shell: ${command} ${args.join(' ')}`);

    return new Promise((resolve) => {
      const child = execFile(command, args, {
        timeout: timeoutMs,
        maxBuffer: MAX_OUTPUT * 2,
        cwd: cwd || undefined,
        env: { ...process.env, ...env },
      }, (err, stdout, stderr) => {
        const exitCode = child.exitCode ?? (err ? 1 : 0);
        const stdoutStr = stdout.slice(0, MAX_OUTPUT);
        const stderrStr = stderr.slice(0, MAX_OUTPUT);

        if (stdoutStr) ctx?.logger.info(stdoutStr);
        if (stderrStr) ctx?.logger.warn(stderrStr);

        resolve({
          exitCode,
          stdout: stdoutStr,
          stderr: stderrStr,
          ...(err ? { error: err.message } : {}),
        });
      });
    });
  },
};
