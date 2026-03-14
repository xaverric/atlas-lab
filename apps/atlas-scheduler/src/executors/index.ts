import type { Executor } from './types.js';
import { httpExecutor } from './http.js';
import { webhookExecutor } from './webhook.js';
import { shellExecutor } from './shell.js';
import { scriptExecutor } from './script.js';
import { monitorExecutor } from './monitor.js';

const executors: Record<string, Executor> = {
  http: httpExecutor,
  webhook: webhookExecutor,
  shell: shellExecutor,
  script: scriptExecutor,
  monitor: monitorExecutor,
};

export const getExecutor = (type: string): Executor => {
  const executor = executors[type];
  if (!executor) throw new Error(`Unknown executor type: ${type}`);
  return executor;
};

export type { ExecutionResult } from './types.js';
