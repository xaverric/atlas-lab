import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { request } from '../client.js';
import { getAuth } from '../session.js';

const API = '/api/v1/files/folders';

export const registerDmsFolderTools = (server: McpServer) => {
  server.tool(
    'dms_create_folder',
    'Create a new DMS folder',
    {
      name: z.string().describe('Folder name'),
      parentId: z.string().nullable().optional().describe('Parent folder ID'),
    },
    async (body, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('dms', { method: 'POST', path: API, token, sessionId, body });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'dms_list_folders',
    'List DMS folders',
    {},
    async (_args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('dms', { path: API, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'dms_get_folder',
    'Get a DMS folder by ID',
    { id: z.string().describe('Folder ID') },
    async ({ id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('dms', { path: `${API}/${id}`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'dms_update_folder',
    'Update a DMS folder (name or parent)',
    {
      id: z.string().describe('Folder ID'),
      name: z.string().optional().describe('New folder name'),
      parentId: z.string().nullable().optional().describe('New parent folder ID'),
    },
    async ({ id, ...body }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('dms', { method: 'PATCH', path: `${API}/${id}`, token, sessionId, body });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'dms_delete_folder',
    'Delete a DMS folder',
    { id: z.string().describe('Folder ID') },
    async ({ id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      await request('dms', { method: 'DELETE', path: `${API}/${id}`, token, sessionId });
      return { content: [{ type: 'text', text: 'Folder deleted' }] };
    },
  );

  server.tool(
    'dms_set_folder_public',
    'Set a folder as public or private with permission level',
    {
      id: z.string().describe('Folder ID'),
      isPublic: z.boolean().describe('Whether the folder is public'),
      publicPermission: z.enum(['view', 'edit', 'full']).optional().describe('Permission level for public access'),
    },
    async ({ id, ...body }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('dms', { method: 'PATCH', path: `${API}/${id}/public`, token, sessionId, body });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
};
