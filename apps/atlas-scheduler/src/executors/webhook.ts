import type { Executor, ExecutionResult } from './types.js';

export const webhookExecutor: Executor = {
  async execute(config, timeoutMs): Promise<ExecutionResult> {
    const { url, payload = {} } = config as { url: string; payload?: unknown };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const text = await res.text();
      return { statusCode: res.status, body: text.slice(0, 10_000) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    } finally {
      clearTimeout(timer);
    }
  },
};
