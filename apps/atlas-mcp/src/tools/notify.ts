import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { request } from '../client.js';
import { getAuth } from '../session.js';

const API = '/api/v1/notifications';

export const registerNotifyTools = (server: McpServer) => {
  server.tool(
    'notify_list',
    'Get notification history for the current user',
    {
      page: z.number().optional().describe('Page number'),
      limit: z.number().optional().describe('Items per page'),
    },
    async (args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const query: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined) query[k] = String(v);
      }
      const result = await request('notify', { path: API, token, sessionId, query });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notify_unread_count',
    'Get the count of unread notifications',
    {},
    async (_args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notify', { path: `${API}/unread-count`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notify_mark_read',
    'Mark a specific notification as read',
    { id: z.string().describe('Notification ID') },
    async ({ id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notify', { method: 'PATCH', path: `${API}/${id}/read`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notify_mark_all_read',
    'Mark all notifications as read',
    {},
    async (_args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notify', { method: 'POST', path: `${API}/mark-all-read`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notify_list_channels',
    'List notification channels for the current user',
    {},
    async (_args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notify', { path: `${API}/channels`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notify_list_rules',
    'List notification preference rules',
    {},
    async (_args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notify', { path: `${API}/preferences/rules`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notify_list_templates',
    'List notification templates',
    {},
    async (_args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notify', { path: `${API}/templates`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notify_create_template',
    'Create a notification template',
    {
      key: z.string().describe('Unique template key'),
      name: z.string().describe('Template name'),
      subject: z.string().optional().describe('Email subject template'),
      body: z.string().describe('Template body (supports {{variables}})'),
      channels: z.array(z.string()).optional().describe('Applicable channels'),
    },
    async (body, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notify', { method: 'POST', path: `${API}/templates`, token, sessionId, body });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
};
