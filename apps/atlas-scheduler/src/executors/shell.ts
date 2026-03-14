import { execFile } from 'node:child_process';
import type { Executor, ExecutionResult } from './types.js';

const MAX_OUTPUT = 50_000;

export const shellExecutor: Executor = {
  execute(config, timeoutMs): Promise<ExecutionResult> {
    const { command } = config as { command: string };

    return new Promise((resolve) => {
      const child = execFile('/bin/sh', ['-c', command], {
        timeout: timeoutMs,
        maxBuffer: MAX_OUTPUT,
      }, (err, stdout, stderr) => {
        resolve({
          exitCode: child.exitCode ?? (err ? 1 : 0),
          stdout: stdout.slice(0, MAX_OUTPUT),
          stderr: stderr.slice(0, MAX_OUTPUT),
          ...(err ? { error: err.message } : {}),
        });
      });
    });
  },
};
