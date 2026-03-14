import type { Executor, ExecutionResult } from './types.js';

export const monitorExecutor: Executor = {
  async execute(config, timeoutMs): Promise<ExecutionResult> {
    const {
      url,
      expectedStatus = 200,
      expectedBody,
    } = config as {
      url: string;
      expectedStatus?: number;
      expectedBody?: string;
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { signal: controller.signal });
      const body = await res.text();

      const statusOk = res.status === expectedStatus;
      const bodyOk = !expectedBody || body.includes(expectedBody);

      if (!statusOk || !bodyOk) {
        return {
          statusCode: res.status,
          body: body.slice(0, 10_000),
          error: !statusOk
            ? `Expected status ${expectedStatus}, got ${res.status}`
            : `Response body does not contain expected string`,
        };
      }

      return { statusCode: res.status, body: body.slice(0, 10_000) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    } finally {
      clearTimeout(timer);
    }
  },
};
