import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { request } from '../client.js';
import { getAuth } from '../session.js';

const API = '/api/v1/notes/folders';

export const registerNotesFolderTools = (server: McpServer) => {
  server.tool(
    'notes_create_folder',
    'Create a notes folder',
    {
      name: z.string().describe('Folder name'),
      parentId: z.string().nullable().optional().describe('Parent folder ID'),
    },
    async (body, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notes', { method: 'POST', path: API, token, sessionId, body });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notes_list_folders',
    'List notes folders',
    {},
    async (_args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notes', { path: API, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notes_get_folder',
    'Get a notes folder by ID',
    { id: z.string().describe('Folder ID') },
    async ({ id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notes', { path: `${API}/${id}`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notes_update_folder',
    'Update a notes folder (name, parent, visibility, AI access)',
    {
      id: z.string().describe('Folder ID'),
      name: z.string().optional().describe('New name'),
      parentId: z.string().nullable().optional().describe('New parent folder ID'),
      visibility: z.enum(['private', 'public']).optional().describe('Folder visibility'),
      aiAccessible: z.boolean().optional().describe('Whether AI search can access notes in this folder'),
      publicPermission: z.enum(['view', 'edit', 'full']).optional().describe('Public permission level'),
    },
    async ({ id, ...body }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notes', { method: 'PATCH', path: `${API}/${id}`, token, sessionId, body });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notes_delete_folder',
    'Delete a notes folder',
    { id: z.string().describe('Folder ID') },
    async ({ id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      await request('notes', { method: 'DELETE', path: `${API}/${id}`, token, sessionId });
      return { content: [{ type: 'text', text: 'Folder deleted' }] };
    },
  );
};
