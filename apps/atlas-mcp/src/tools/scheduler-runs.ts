import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { request } from '../client.js';
import { getAuth } from '../session.js';

export const registerSchedulerRunTools = (server: McpServer) => {
  server.tool(
    'scheduler_list_runs',
    'List runs for a specific job',
    {
      jobId: z.string().describe('Job ID'),
      page: z.number().optional().describe('Page number'),
      limit: z.number().optional().describe('Items per page'),
    },
    async ({ jobId, ...args }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const query: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined) query[k] = String(v);
      }
      const result = await request('scheduler', {
        path: `/api/v1/scheduler/jobs/${jobId}/runs`,
        token,
        sessionId,
        query,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'scheduler_get_run',
    'Get details of a specific job run',
    { id: z.string().describe('Run ID') },
    async ({ id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('scheduler', { path: `/api/v1/scheduler/runs/${id}`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
};
