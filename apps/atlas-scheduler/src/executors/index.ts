import type { Executor } from './types.js';
import { webhookExecutor } from './webhook.js';
import { javascriptExecutor } from './javascript.js';
import { shellExecutor } from './shell.js';
import { gitExecutor } from './git.js';
import { n8nExecutor } from './n8n.js';

const executors: Record<string, Executor> = {
  webhook: webhookExecutor,
  javascript: javascriptExecutor,
  shell: shellExecutor,
  git: gitExecutor,
  n8n: n8nExecutor,
};

export const getExecutor = (type: string): Executor => {
  const executor = executors[type];
  if (!executor) throw new Error(`Unknown executor type: ${type}. Allowed: webhook, javascript, shell, git, n8n`);
  return executor;
};

export type { ExecutionResult, ExecutionContext, RunLogger, StorageAccess } from './types.js';
