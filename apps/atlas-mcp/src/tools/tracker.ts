import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { request } from '../client.js';
import { getAuth } from '../session.js';

const API = '/api/v1/tracker/endpoints';

export const registerTrackerTools = (server: McpServer) => {
  server.tool(
    'tracker_create_endpoint',
    'Create a tracker endpoint with a JSON schema for data collection',
    {
      name: z.string().describe('URL-friendly slug (2-64 chars, lowercase alphanumeric + hyphens)'),
      displayName: z.string().describe('Display name'),
      description: z.string().optional().describe('Description'),
      visibility: z.enum(['private', 'public']).optional().describe('Endpoint visibility'),
      schema: z.object({
        type: z.literal('object'),
        properties: z.record(z.unknown()),
        required: z.array(z.string()).optional(),
      }).passthrough().describe('JSON Schema for validating submitted data'),
      indexes: z.array(z.object({
        fields: z.record(z.unknown()),
        options: z.record(z.unknown()).optional(),
      })).optional().describe('MongoDB indexes'),
      retentionDays: z.number().optional().describe('Auto-delete data after N days'),
    },
    async (body, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('tracker', { method: 'POST', path: API, token, sessionId, body });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'tracker_list_endpoints',
    'List all tracker endpoints',
    {},
    async (_args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('tracker', { path: API, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'tracker_get_endpoint',
    'Get a tracker endpoint by name',
    { name: z.string().describe('Endpoint name (slug)') },
    async ({ name }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('tracker', { path: `${API}/${name}`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'tracker_update_endpoint',
    'Update a tracker endpoint',
    {
      name: z.string().describe('Endpoint name (slug)'),
      displayName: z.string().optional().describe('New display name'),
      description: z.string().optional().describe('New description'),
      visibility: z.enum(['private', 'public']).optional().describe('New visibility'),
      schema: z.object({
        type: z.literal('object'),
        properties: z.record(z.unknown()),
        required: z.array(z.string()).optional(),
      }).passthrough().optional().describe('Updated JSON Schema'),
      retentionDays: z.number().nullable().optional().describe('Updated retention (null to disable)'),
    },
    async ({ name, ...body }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('tracker', { method: 'PUT', path: `${API}/${name}`, token, sessionId, body });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'tracker_delete_endpoint',
    'Delete a tracker endpoint and all its data',
    { name: z.string().describe('Endpoint name (slug)') },
    async ({ name }, extra) => {
      const { token, sessionId } = getAuth(extra);
      await request('tracker', { method: 'DELETE', path: `${API}/${name}`, token, sessionId });
      return { content: [{ type: 'text', text: 'Endpoint deleted' }] };
    },
  );

  server.tool(
    'tracker_submit_data',
    'Submit data to a tracker endpoint',
    {
      endpointName: z.string().describe('Endpoint name (slug)'),
      data: z.record(z.unknown()).describe('Data object matching the endpoint schema'),
    },
    async ({ endpointName, data }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('tracker', {
        method: 'POST',
        path: `${API}/${endpointName}/data`,
        token,
        sessionId,
        body: data,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'tracker_query_data',
    'Query data from a tracker endpoint',
    {
      endpointName: z.string().describe('Endpoint name (slug)'),
      page: z.number().optional().describe('Page number'),
      limit: z.number().optional().describe('Items per page'),
      sort: z.string().optional().describe('Sort field'),
      order: z.enum(['asc', 'desc']).optional().describe('Sort order'),
      from: z.string().optional().describe('Start date (ISO)'),
      to: z.string().optional().describe('End date (ISO)'),
    },
    async ({ endpointName, ...args }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const query: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined) query[k] = String(v);
      }
      const result = await request('tracker', {
        path: `${API}/${endpointName}/data`,
        token,
        sessionId,
        query,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'tracker_delete_data',
    'Delete a specific data entry from a tracker endpoint',
    {
      endpointName: z.string().describe('Endpoint name (slug)'),
      id: z.string().describe('Data entry ID'),
    },
    async ({ endpointName, id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      await request('tracker', {
        method: 'DELETE',
        path: `${API}/${endpointName}/data/${id}`,
        token,
        sessionId,
      });
      return { content: [{ type: 'text', text: 'Data entry deleted' }] };
    },
  );
};
