import { execFile, execFileSync } from 'node:child_process';
import vm from 'node:vm';
import type { Executor, ExecutionResult, ExecutionContext } from './types.js';

const MAX_OUTPUT = 50_000;
const SANDBOX_IMAGE = 'node:22-alpine';

const dockerAvailable = (() => {
  try {
    execFileSync('docker', ['info'], { timeout: 3000, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const executeInDocker = (code: string, timeoutMs: number, ctx?: ExecutionContext): Promise<ExecutionResult> => {
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
    });
  `;

  const timeoutSec = Math.ceil(timeoutMs / 1000);

  return new Promise((resolve) => {
    const child = execFile('docker', [
      'run', '--rm',
      '--network=none',
      '--memory=128m',
      '--cpus=0.5',
      '--read-only',
      '--no-new-privileges',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      `--stop-timeout=${timeoutSec}`,
      SANDBOX_IMAGE,
      'node', '-e', wrappedCode,
    ], {
      timeout: timeoutMs + 5000,
      maxBuffer: MAX_OUTPUT * 2,
      env: {},
    }, (err, stdout, stderr) => {
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
        resolve({
          exitCode: child.exitCode ?? (err ? 1 : 0),
          stdout: stdoutStr,
          stderr: stderr.slice(0, MAX_OUTPUT),
          ...(err ? { error: err.message } : {}),
        });
      }
    });
  });
};

const executeInVm = async (code: string, timeoutMs: number, ctx?: ExecutionContext): Promise<ExecutionResult> => {
  let stdout = '';
  const log = (...args: unknown[]) => {
    const line = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    stdout += line + '\n';
    ctx?.logger.info(line);
  };

  // vm sandbox — restricted, no network, no fs, no env
  const sandbox = {
    console: { log, info: log, warn: log, error: log },
    JSON, Date, Math, Array, Object, Map, Set, RegExp, Error, Promise,
    String: globalThis.String, Number: globalThis.Number, Boolean: globalThis.Boolean,
    URL, URLSearchParams, TextEncoder, TextDecoder,
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    __result: undefined as unknown,
  };

  const wrappedCode = `(async () => { ${code} })().then(r => { __result = r; }).catch(e => { throw e; });`;

  try {
    const context = vm.createContext(sandbox);
    const script = new vm.Script(wrappedCode);
    await script.runInContext(context, { timeout: timeoutMs });
    return { stdout: stdout.slice(0, MAX_OUTPUT), data: sandbox.__result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    ctx?.logger.error(`Execution error: ${message}`);
    return { exitCode: 1, stdout: stdout.slice(0, MAX_OUTPUT), error: message };
  }
};

export const javascriptExecutor: Executor = {
  async execute(config, timeoutMs, ctx?: ExecutionContext): Promise<ExecutionResult> {
    const { code } = config as { code: string };

    if (dockerAvailable) {
      ctx?.logger.info('Executing JavaScript in isolated Docker container');
      return executeInDocker(code, timeoutMs, ctx);
    }

    ctx?.logger.warn('Docker not available — falling back to vm sandbox (reduced isolation)');
    return executeInVm(code, timeoutMs, ctx);
  },
};
