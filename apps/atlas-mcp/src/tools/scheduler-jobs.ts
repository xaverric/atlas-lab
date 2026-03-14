import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { request } from '../client.js';
import { getAuth } from '../session.js';

const API = '/api/v1/scheduler/jobs';

export const registerSchedulerJobTools = (server: McpServer) => {
  server.tool(
    'scheduler_create_job',
    'Create a scheduled job. Supports webhook, javascript, shell, git, and n8n execution types',
    {
      name: z.string().describe('Job name (1-200 chars)'),
      description: z.string().optional().describe('Job description'),
      executionType: z.enum(['webhook', 'javascript', 'shell', 'git', 'n8n']).describe('Executor type'),
      enabled: z.boolean().optional().describe('Whether job is enabled (default true)'),
      schedule: z.object({
        type: z.enum(['cron', 'once']).describe('Schedule type'),
        expression: z.string().optional().describe('Cron expression (required if type=cron)'),
        timezone: z.string().optional().describe('Timezone (default UTC)'),
        runAt: z.string().optional().describe('ISO datetime (required if type=once)'),
      }).describe('Schedule configuration'),
      config: z.record(z.unknown()).describe('Executor-specific config (webhook: url/method/headers/body/auth, shell: command/args/env, javascript: code/env, git: operation/repoUrl/branch, n8n: webhookUrl/payload)'),
      timeoutMs: z.number().optional().describe('Timeout in ms (1000-600000, default 30000)'),
      tags: z.array(z.string()).optional().describe('Job tags'),
      retryPolicy: z.object({
        maxRetries: z.number().optional().describe('Max retries (0-10)'),
        delayMs: z.number().optional().describe('Retry delay ms'),
        backoffMultiplier: z.number().optional().describe('Backoff multiplier (1-10)'),
      }).optional().describe('Retry policy'),
      notifications: z.array(z.object({
        trigger: z.enum(['onSuccess', 'onFailure', 'onEvaluationFailure', 'onTimeout', 'onRecovery']),
        channel: z.enum(['webhook', 'email', 'telegram']),
        config: z.record(z.unknown()),
      })).optional().describe('Notification hooks'),
    },
    async (body, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('scheduler', { method: 'POST', path: API, token, sessionId, body });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'scheduler_list_jobs',
    'List scheduled jobs with optional filters',
    {
      page: z.number().optional().describe('Page number'),
      limit: z.number().optional().describe('Items per page'),
      executionType: z.enum(['webhook', 'javascript', 'shell', 'git', 'n8n']).optional().describe('Filter by type'),
      enabled: z.boolean().optional().describe('Filter by enabled status'),
      tags: z.string().optional().describe('Comma-separated tags'),
      search: z.string().optional().describe('Search in job names'),
    },
    async (args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const query: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined) query[k] = String(v);
      }
      const result = await request('scheduler', { path: API, token, sessionId, query });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'scheduler_get_job',
    'Get a scheduled job by ID',
    { id: z.string().describe('Job ID') },
    async ({ id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('scheduler', { path: `${API}/${id}`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'scheduler_update_job',
    'Update a scheduled job',
    {
      id: z.string().describe('Job ID'),
      name: z.string().optional().describe('New job name'),
      description: z.string().optional().describe('New description'),
      schedule: z.object({
        type: z.enum(['cron', 'once']).optional(),
        expression: z.string().optional(),
        timezone: z.string().optional(),
        runAt: z.string().optional(),
      }).optional().describe('Updated schedule'),
      config: z.record(z.unknown()).optional().describe('Updated executor config'),
      timeoutMs: z.number().optional().describe('Updated timeout'),
      tags: z.array(z.string()).optional().describe('Updated tags'),
      retryPolicy: z.object({
        maxRetries: z.number().optional(),
        delayMs: z.number().optional(),
        backoffMultiplier: z.number().optional(),
      }).optional().describe('Updated retry policy'),
    },
    async ({ id, ...body }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('scheduler', { method: 'PATCH', path: `${API}/${id}`, token, sessionId, body });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'scheduler_delete_job',
    'Delete a scheduled job',
    { id: z.string().describe('Job ID') },
    async ({ id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      await request('scheduler', { method: 'DELETE', path: `${API}/${id}`, token, sessionId });
      return { content: [{ type: 'text', text: 'Job deleted' }] };
    },
  );

  server.tool(
    'scheduler_run_job',
    'Trigger an immediate manual run of a job',
    { id: z.string().describe('Job ID') },
    async ({ id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('scheduler', { method: 'POST', path: `${API}/${id}/run`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'scheduler_toggle_job',
    'Enable or disable a scheduled job',
    {
      id: z.string().describe('Job ID'),
      enabled: z.boolean().describe('true to enable, false to disable'),
    },
    async ({ id, enabled }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const endpoint = enabled ? 'enable' : 'disable';
      const result = await request('scheduler', { method: 'POST', path: `${API}/${id}/${endpoint}`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
};
