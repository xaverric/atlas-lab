import { fork } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import crypto from 'node:crypto';
import type { Executor, ExecutionResult } from './types.js';

const MAX_OUTPUT = 50_000;

export const scriptExecutor: Executor = {
  async execute(config, timeoutMs): Promise<ExecutionResult> {
    const { code } = config as { code: string };

    const tmpFile = join(tmpdir(), `atlas-script-${crypto.randomUUID()}.mjs`);
    await writeFile(tmpFile, code, 'utf-8');

    try {
      return await new Promise<ExecutionResult>((resolve) => {
        let stdout = '';
        let stderr = '';

        const child = fork(tmpFile, [], {
          timeout: timeoutMs,
          silent: true,
        });

        child.stdout?.on('data', (data) => { stdout += data; });
        child.stderr?.on('data', (data) => { stderr += data; });

        child.on('close', (exitCode) => {
          resolve({
            exitCode: exitCode ?? 0,
            stdout: stdout.slice(0, MAX_OUTPUT),
            stderr: stderr.slice(0, MAX_OUTPUT),
          });
        });

        child.on('error', (err) => {
          resolve({
            exitCode: 1,
            stdout: stdout.slice(0, MAX_OUTPUT),
            stderr: stderr.slice(0, MAX_OUTPUT),
            error: err.message,
          });
        });
      });
    } finally {
      await unlink(tmpFile).catch(() => {});
    }
  },
};
