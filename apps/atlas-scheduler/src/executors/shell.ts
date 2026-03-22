import { execFile } from 'node:child_process';
import path from 'node:path';
import { config } from '../config/index.js';
import type { Executor, ExecutionResult, ExecutionContext } from './types.js';

const MAX_OUTPUT = 50_000;
const ALLOWED_CWD_ROOTS = ['/tmp', '/home', '/app'];
const SENSITIVE_ENV_KEYS = ['INTERNAL_KEY', 'VAPID_PRIVATE_KEY', 'SMTP_PASS', 'MINIO_SECRET_KEY'];

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

    if (cwd) {
      const resolved = path.resolve(cwd);
      if (!ALLOWED_CWD_ROOTS.some(root => resolved.startsWith(root))) {
        ctx?.logger.error(`Shell cwd "${cwd}" is outside allowed directories`);
        return Promise.resolve({ exitCode: 1, error: `Working directory "${cwd}" is not allowed. Allowed: ${ALLOWED_CWD_ROOTS.join(', ')}` });
      }
    }

    ctx?.logger.info(`Shell: ${command} ${args.join(' ')}`);

    const cleanEnv = Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !SENSITIVE_ENV_KEYS.includes(k))
    );

    return new Promise((resolve) => {
      const child = execFile(command, args, {
        timeout: timeoutMs,
        maxBuffer: MAX_OUTPUT * 2,
        cwd: cwd || undefined,
        env: { ...cleanEnv, ...env },
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
