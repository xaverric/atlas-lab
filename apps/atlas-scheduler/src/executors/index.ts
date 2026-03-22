import type { Executor } from './types.js';
import { webhookExecutor } from './webhook.js';
import { javascriptExecutor } from './javascript.js';

const executors: Record<string, Executor> = {
  webhook: webhookExecutor,
  javascript: javascriptExecutor,
};

export const getExecutor = (type: string): Executor => {
  const executor = executors[type];
  if (!executor) throw new Error(`Unknown executor type: ${type}. Allowed: webhook, javascript`);
  return executor;
};

export type { ExecutionResult, ExecutionContext, RunLogger, StorageAccess } from './types.js';
