import type { Executor, ExecutionResult, ExecutionContext } from './types.js';

const MAX_BODY = 50_000;

interface N8nExecutorConfig {
  webhookUrl: string;
  payload?: object;
  waitForCompletion?: boolean;
}

export const n8nExecutor: Executor = {
  async execute(cfg, timeoutMs, ctx?: ExecutionContext): Promise<ExecutionResult> {
    const { webhookUrl, payload, waitForCompletion = true } = cfg as unknown as N8nExecutorConfig;

    ctx?.logger.info(`n8n webhook: POST ${webhookUrl} (waitForCompletion=${waitForCompletion})`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload ?? {}),
        signal: controller.signal,
      });

      const responseBody = (await res.text()).slice(0, MAX_BODY);
      ctx?.logger.info(`Response: ${res.status}`, { statusCode: res.status, bodyLength: responseBody.length });

      return {
        statusCode: res.status,
        body: responseBody,
        ...(res.status >= 400 ? { error: `n8n webhook returned ${res.status}` } : {}),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      ctx?.logger.error(`n8n webhook failed: ${message}`);
      return { error: message };
    } finally {
      clearTimeout(timer);
    }
  },
};
