import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { request } from '../client.js';
import { getAuth } from '../session.js';

const API = '/api/v1/notes';

export const registerNotesTools = (server: McpServer) => {
  server.tool(
    'notes_create',
    'Create a new note (markdown content)',
    {
      title: z.string().describe('Note title'),
      content: z.string().optional().describe('Markdown content'),
      folderId: z.string().nullable().optional().describe('Folder ID'),
      tags: z.array(z.string()).optional().describe('Tags'),
      isPublic: z.boolean().optional().describe('Make note publicly accessible'),
    },
    async (body, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notes', { method: 'POST', path: API, token, sessionId, body });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notes_list',
    'List notes with pagination, filtering, and sorting',
    {
      page: z.number().optional().describe('Page number'),
      limit: z.number().optional().describe('Items per page'),
      folderId: z.string().optional().describe('Filter by folder ID'),
      tags: z.string().optional().describe('Comma-separated tags'),
      search: z.string().optional().describe('Full-text search'),
      sortBy: z.enum(['title', 'createdAt', 'updatedAt']).optional().describe('Sort field'),
      sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
    },
    async (args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const query: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined) query[k] = String(v);
      }
      const result = await request('notes', { path: API, token, sessionId, query });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notes_get',
    'Get a note by ID (returns full markdown content)',
    { id: z.string().describe('Note ID') },
    async ({ id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notes', { path: `${API}/${id}`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notes_update',
    'Update a note (title, content, tags, folder, visibility)',
    {
      id: z.string().describe('Note ID'),
      title: z.string().optional().describe('New title'),
      content: z.string().optional().describe('New markdown content'),
      tags: z.array(z.string()).optional().describe('New tags'),
      folderId: z.string().nullable().optional().describe('New folder ID'),
      isPublic: z.boolean().optional().describe('Public visibility'),
      dmsFolderId: z.string().optional().describe('Linked DMS folder ID'),
    },
    async ({ id, ...body }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notes', { method: 'PATCH', path: `${API}/${id}`, token, sessionId, body });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notes_delete',
    'Delete a note by ID',
    { id: z.string().describe('Note ID') },
    async ({ id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      await request('notes', { method: 'DELETE', path: `${API}/${id}`, token, sessionId });
      return { content: [{ type: 'text', text: 'Note deleted' }] };
    },
  );

  server.tool(
    'notes_get_tags',
    'Get all unique note tags',
    {},
    async (_args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notes', { path: `${API}/tags`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notes_search',
    'Search notes using full-text and vector search',
    {
      query: z.string().describe('Search query'),
      folderId: z.string().optional().describe('Restrict to folder'),
      tags: z.array(z.string()).optional().describe('Filter by tags'),
      limit: z.number().optional().describe('Max results (1-50)'),
    },
    async (body, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notes', {
        method: 'POST',
        path: '/api/v1/notes/search',
        token,
        sessionId,
        body,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'notes_ai_search',
    'Semantic AI search across all notes using vector embeddings',
    {
      query: z.string().describe('Natural language search query'),
      limit: z.number().optional().describe('Max results (1-50)'),
    },
    async (body, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('notes', {
        method: 'POST',
        path: '/api/v1/notes/search/ai',
        token,
        sessionId,
        body,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
};
