import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { request, uploadMultipart } from '../client.js';
import { getAuth } from '../session.js';

const API = '/api/v1/files/documents';

export const registerDmsDocumentTools = (server: McpServer) => {
  server.tool(
    'dms_upload_document',
    'Upload a document to DMS. Provide file content as base64',
    {
      filename: z.string().describe('File name with extension'),
      mimeType: z.string().describe('MIME type (e.g. application/pdf)'),
      base64Content: z.string().describe('File content encoded as base64'),
      folderId: z.string().optional().describe('Target folder ID'),
      tags: z.array(z.string()).optional().describe('Tags for the document'),
    },
    async ({ filename, mimeType, base64Content, folderId, tags }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const fields: Record<string, string> = {};
      if (folderId) fields.folderId = folderId;
      if (tags?.length) fields.tags = JSON.stringify(tags);
      const result = await uploadMultipart('dms', {
        path: API,
        token,
        sessionId,
        filename,
        mimeType,
        base64Content,
        fields,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'dms_list_documents',
    'List documents with pagination, filtering, and sorting',
    {
      page: z.number().optional().describe('Page number'),
      limit: z.number().optional().describe('Items per page'),
      folderId: z.string().optional().describe('Filter by folder ID'),
      tags: z.string().optional().describe('Comma-separated tags'),
      search: z.string().optional().describe('Search in document names'),
      mimeType: z.string().optional().describe('Filter by MIME type'),
      dateFrom: z.string().optional().describe('Start date (ISO)'),
      dateTo: z.string().optional().describe('End date (ISO)'),
      sortBy: z.enum(['name', 'size', 'createdAt', 'mimeType']).optional().describe('Sort field'),
      sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
    },
    async (args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const query: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined) query[k] = String(v);
      }
      const result = await request('dms', { path: API, token, sessionId, query });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'dms_get_document',
    'Get a document by ID',
    { id: z.string().describe('Document ID') },
    async ({ id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('dms', { path: `${API}/${id}`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'dms_update_document',
    'Update document metadata (name, tags, folder)',
    {
      id: z.string().describe('Document ID'),
      name: z.string().optional().describe('New document name'),
      tags: z.array(z.string()).optional().describe('New tags'),
      folderId: z.string().nullable().optional().describe('New folder ID (null to move to root)'),
    },
    async ({ id, ...body }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('dms', { method: 'PATCH', path: `${API}/${id}`, token, sessionId, body });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'dms_delete_document',
    'Delete a document by ID',
    { id: z.string().describe('Document ID') },
    async ({ id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      await request('dms', { method: 'DELETE', path: `${API}/${id}`, token, sessionId });
      return { content: [{ type: 'text', text: 'Document deleted' }] };
    },
  );

  server.tool(
    'dms_download_document',
    'Get a presigned download URL for a document',
    { id: z.string().describe('Document ID') },
    async ({ id }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('dms', { path: `${API}/${id}/download`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'dms_get_tags',
    'Get all unique document tags',
    {},
    async (_args, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('dms', { path: `${API}/tags`, token, sessionId });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'dms_bulk_delete_documents',
    'Delete multiple documents at once',
    { ids: z.array(z.string()).min(1).max(100).describe('Array of document IDs to delete') },
    async ({ ids }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('dms', { method: 'POST', path: `${API}/bulk-delete`, token, sessionId, body: { ids } });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'dms_bulk_move_documents',
    'Move multiple documents to a folder',
    {
      ids: z.array(z.string()).min(1).max(100).describe('Array of document IDs'),
      folderId: z.string().nullable().describe('Target folder ID (null for root)'),
    },
    async ({ ids, folderId }, extra) => {
      const { token, sessionId } = getAuth(extra);
      const result = await request('dms', { method: 'POST', path: `${API}/bulk-move`, token, sessionId, body: { ids, folderId } });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
};
