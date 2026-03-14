import vm from 'node:vm';
import type { Executor, ExecutionResult, ExecutionContext } from './types.js';

const MAX_OUTPUT = 50_000;

export const javascriptExecutor: Executor = {
  async execute(config, timeoutMs, ctx?: ExecutionContext): Promise<ExecutionResult> {
    const { code, env = {} } = config as { code: string; env?: Record<string, string> };

    let stdout = '';
    const log = (...args: unknown[]) => {
      const line = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      stdout += line + '\n';
      ctx?.logger.info(line);
    };

    const console = {
      log,
      info: log,
      warn: (...args: unknown[]) => {
        const line = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        stdout += `[WARN] ${line}\n`;
        ctx?.logger.warn(line);
      },
      error: (...args: unknown[]) => {
        const line = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        stdout += `[ERROR] ${line}\n`;
        ctx?.logger.error(line);
      },
    };

    const httpFetch = async (url: string, options?: RequestInit) => {
      ctx?.logger.info(`fetch: ${options?.method || 'GET'} ${url}`);
      const res = await fetch(url, options);
      const text = await res.text();
      let json: unknown;
      try { json = JSON.parse(text); } catch { json = undefined; }
      return { status: res.status, ok: res.ok, text, json, headers: Object.fromEntries(res.headers) };
    };

    const storage = ctx?.storage
      ? {
          get: (key: string) => ctx.storage.get(key),
          set: (key: string, value: unknown) => ctx.storage.set(key, value),
          remove: (key: string) => ctx.storage.remove(key),
        }
      : { get: async () => undefined, set: async () => {}, remove: async () => {} };

    const sandbox = {
      console,
      env: { ...env },
      http: { fetch: httpFetch },
      storage,
      jobId: ctx?.jobId,
      runId: ctx?.runId,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      JSON,
      Date,
      Math,
      Array,
      Object,
      String: globalThis.String,
      Number: globalThis.Number,
      Boolean: globalThis.Boolean,
      Map,
      Set,
      RegExp,
      Error,
      Promise,
      URL,
      URLSearchParams,
      Buffer,
      TextEncoder,
      TextDecoder,
      __result: undefined as unknown,
    };

    const wrappedCode = `
      (async () => {
        ${code}
      })().then(r => { __result = r; }).catch(e => { throw e; });
    `;

    ctx?.logger.info('Executing JavaScript code');

    try {
      const context = vm.createContext(sandbox);
      const script = new vm.Script(wrappedCode);
      const promise = script.runInContext(context, { timeout: timeoutMs });
      await promise;

      return {
        stdout: stdout.slice(0, MAX_OUTPUT),
        data: sandbox.__result,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      ctx?.logger.error(`Execution error: ${message}`);
      return {
        exitCode: 1,
        stdout: stdout.slice(0, MAX_OUTPUT),
        error: message,
      };
    }
  },
};
