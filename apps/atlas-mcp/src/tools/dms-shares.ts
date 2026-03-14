import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { request } from '../client.js';
import { getAuth } from '../session.js';

const API = '/api/v1/files/shares';

export const registerDmsShareTools = (server: McpServer) => {
  server.tool(
    'dms_create_share',
    'Create a share link for a document or folder',
    {
      documentId: z.string().optional().describe('Document ID to share'),
      folderId: z.string().optional().describe('Folder ID to share'),
      type: z.enum(['document', 'folder']).optional().describe('Share type (default: document)'),
      expiresInHours: z.number().optional().describe('Link expiry in hours (1-8760, default 24)'),
      maxDownloads: z.number().optional().describe('Max downloads (0 = unlimited)'),
      password: z.string().optional().describe('Password protect the share'),
    },
    async (body, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('dms', { method: 'POST', path: API, token, sessionId, body });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'dms_resolve_share',
    'Resolve a share token to get the shared resource',
    { token: z.string().describe('Share token') },
    async ({ token: shareToken }, extra) => {
      const { token: jwt, sessionId } = getAuth(extra);
      const result = await request('dms', { path: `${API}/${shareToken}`, token: jwt, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'dms_revoke_share',
    'Revoke a share link by ID',
    { id: z.string().describe('Share ID') },
    async ({ id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      await request('dms', { method: 'DELETE', path: `${API}/${id}`, token, sessionId });
      return { content: [{ type: 'text', text: 'Share revoked' }] };
    },
  );
};
