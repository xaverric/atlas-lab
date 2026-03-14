import type { Executor, ExecutionResult } from './types.js';

const MAX_BODY = 10_000;

export const httpExecutor: Executor = {
  async execute(config, timeoutMs): Promise<ExecutionResult> {
    const { url, method = 'GET', headers = {}, body } = config as {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });

      const text = await res.text();
      return {
        statusCode: res.status,
        body: text.slice(0, MAX_BODY),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    } finally {
      clearTimeout(timer);
    }
  },
};
