import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { request } from '../client.js';
import { getAuth } from '../session.js';

export const registerCoreTools = (server: McpServer) => {
  server.tool(
    'core_get_me',
    'Get the current authenticated user profile',
    {},
    async (_args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('core', { path: '/api/v1/users/me', token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'core_update_preferences',
    'Update current user preferences (theme)',
    { theme: z.enum(['light', 'dark', 'system']).describe('UI theme preference') },
    async ({ theme }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('core', {
        method: 'PATCH',
        path: '/api/v1/users/me/preferences',
        token,
        body: { theme },
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'core_list_audit_events',
    'List audit events (admin only). Filter by service, action, category, userId, date range',
    {
      service: z.string().optional().describe('Filter by service name'),
      action: z.string().optional().describe('Filter by action'),
      category: z.string().optional().describe('Filter by category'),
      userId: z.string().optional().describe('Filter by user ID'),
      from: z.string().optional().describe('Start date (ISO)'),
      to: z.string().optional().describe('End date (ISO)'),
      status: z.string().optional().describe('Filter by status'),
      sort: z.string().optional().describe('Sort field'),
      limit: z.number().optional().describe('Max results'),
      offset: z.number().optional().describe('Offset for pagination'),
    },
    async (args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const query: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined) query[k] = String(v);
      }
      const result = await request('core', { path: '/api/v1/audit/events', token, sessionId, query });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
};
