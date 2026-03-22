import { spawn, execFileSync } from 'node:child_process';
import type { Executor, ExecutionResult, ExecutionContext } from './types.js';

const MAX_OUTPUT = 50_000;
const SANDBOX_IMAGE = 'node:22-alpine';

const dockerAvailable = (() => {
  try {
    execFileSync('docker', ['info'], { timeout: 5000, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

export const javascriptExecutor: Executor = {
  async execute(config, timeoutMs, ctx?: ExecutionContext): Promise<ExecutionResult> {
    const { code } = config as { code: string };

    if (!dockerAvailable) {
      ctx?.logger.error('Docker is not available — JavaScript execution requires Docker for isolation');
      return { exitCode: 1, error: 'JavaScript execution requires Docker. Ensure Docker is available to the scheduler service.' };
    }

    ctx?.logger.info('Executing JavaScript in isolated Docker container');

    const wrappedCode = `
const __log = [];
const console = {
  log: (...a) => __log.push(a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')),
  info: (...a) => __log.push(a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')),
  warn: (...a) => __log.push('[WARN] ' + a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')),
  error: (...a) => __log.push('[ERROR] ' + a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')),
};
const http = {
  fetch: async (url, opts) => {
    const r = await fetch(url, opts);
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch {}
    return { status: r.status, ok: r.ok, text: t, json: j };
  }
};
(async () => {
${code}
})().then(r => {
  process.stdout.write(JSON.stringify({ stdout: __log.join('\\n'), data: r }));
}).catch(e => {
  process.stdout.write(JSON.stringify({ stdout: __log.join('\\n'), error: e.message || String(e) }));
  process.exit(1);
});`;

    const timeoutSec = Math.ceil(timeoutMs / 1000);

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn('docker', [
        'run', '--rm', '-i',
        '--network=none',
        '--memory=128m',
        '--cpus=0.5',
        '--read-only',
        '--cap-drop=ALL',
        '--security-opt=no-new-privileges:true',
        `--stop-timeout=${timeoutSec}`,
        SANDBOX_IMAGE,
        'node', '--input-type=module', '-',
      ], { timeout: timeoutMs + 5000, env: {} });

      proc.stdin.write(wrappedCode);
      proc.stdin.end();

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (exitCode) => {
        const stdoutStr = stdout.slice(0, MAX_OUTPUT);
        if (stderr) ctx?.logger.warn(stderr.slice(0, MAX_OUTPUT));

        try {
          const result = JSON.parse(stdoutStr);
          if (result.stdout) ctx?.logger.info(result.stdout);
          resolve({
            stdout: result.stdout || '',
            data: result.data,
            ...(result.error ? { exitCode: 1, error: result.error } : {}),
          });
        } catch {
          ctx?.logger.error(`Container exit ${exitCode}: ${stderr.slice(0, 500) || stdoutStr.slice(0, 500)}`);
          resolve({
            exitCode: exitCode ?? 1,
            stdout: stdoutStr,
            stderr: stderr.slice(0, MAX_OUTPUT),
            error: stderr.slice(0, 500) || `Container exited with code ${exitCode}`,
          });
        }
      });
    });
  },
};
