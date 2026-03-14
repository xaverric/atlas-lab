import express from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createAuth } from '@atlas/server-common';
import { config } from './config.js';
import { setToken, removeSession } from './session.js';
import { registerHealthTools } from './tools/health.js';
import { registerCoreTools } from './tools/core.js';
import { registerDmsDocumentTools } from './tools/dms-documents.js';
import { registerDmsFolderTools } from './tools/dms-folders.js';
import { registerDmsShareTools } from './tools/dms-shares.js';
import { registerSchedulerJobTools } from './tools/scheduler-jobs.js';
import { registerSchedulerRunTools } from './tools/scheduler-runs.js';
import { registerNotesTools } from './tools/notes.js';
import { registerNotesFolderTools } from './tools/notes-folders.js';
import { registerNotifyTools } from './tools/notify.js';
import { registerTrackerTools } from './tools/tracker.js';

const auth = createAuth({
  issuer: config.keycloak.issuer,
  publicIssuer: config.keycloak.publicIssuer,
});

const resourceMetadataUrl = `${config.publicUrl}/.well-known/oauth-protected-resource`;

const requireAuth: express.RequestHandler = (req, res, next) => {
  auth(req, res, (err) => {
    if (err) {
      res.setHeader(
        'WWW-Authenticate',
        `Bearer resource_metadata="${resourceMetadataUrl}"`,
      );
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Authentication required' },
        id: null,
      });
      return;
    }
    next();
  });
};

const createMcpServer = () => {
  const server = new McpServer({
    name: 'atlas-mcp',
    version: '0.1.0',
  });

  registerHealthTools(server);
  registerCoreTools(server);
  registerDmsDocumentTools(server);
  registerDmsFolderTools(server);
  registerDmsShareTools(server);
  registerSchedulerJobTools(server);
  registerSchedulerRunTools(server);
  registerNotesTools(server);
  registerNotesFolderTools(server);
  registerNotifyTools(server);
  registerTrackerTools(server);

  return server;
};

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'atlas-mcp' });
});

// --- OAuth metadata & registration proxy ---

const kcOidc = `${config.keycloak.publicIssuer}/protocol/openid-connect`;

app.get('/.well-known/oauth-protected-resource', (_req, res) => {
  res.json({
    resource: config.publicUrl,
    authorization_servers: [config.publicUrl],
  });
});

app.get('/.well-known/oauth-authorization-server', (_req, res) => {
  res.json({
    issuer: config.publicUrl,
    authorization_endpoint: `${kcOidc}/auth`,
    token_endpoint: `${config.publicUrl}/oauth/token`,
    registration_endpoint: `${config.publicUrl}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['openid', 'profile', 'email'],
  });
});

app.post('/oauth/register', (_req, res) => {
  res.status(201).json({
    client_id: config.keycloak.clientId,
    client_name: 'Atlas MCP',
    redirect_uris: _req.body?.redirect_uris || [],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  });
});

// Temporary store: access_token → refresh_token (paired when client sends first /mcp request)
const pendingRefreshTokens = new Map<string, string>();

app.post('/oauth/token', async (req, res) => {
  const kcTokenUrl = `${config.keycloak.issuer}/protocol/openid-connect/token`;

  let params: URLSearchParams;
  if (typeof req.body === 'string') {
    params = new URLSearchParams(req.body);
  } else if (req.body && typeof req.body === 'object') {
    params = new URLSearchParams(req.body as Record<string, string>);
  } else {
    res.status(400).json({ error: 'Missing request body' });
    return;
  }

  if (!params.has('client_id')) {
    params.set('client_id', config.keycloak.clientId);
  }

  try {
    const kcRes = await fetch(kcTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await kcRes.text();

    if (kcRes.ok) {
      try {
        const parsed = JSON.parse(data) as { access_token?: string; refresh_token?: string };
        if (parsed.access_token && parsed.refresh_token) {
          pendingRefreshTokens.set(parsed.access_token, parsed.refresh_token);
          setTimeout(() => pendingRefreshTokens.delete(parsed.access_token!), 60_000);
        }
      } catch { /* not JSON, skip */ }
    }

    res.status(kcRes.status).set('Content-Type', 'application/json').send(data);
  } catch (err) {
    console.error('Token proxy error:', err);
    res.status(502).json({ error: 'Token exchange failed', detail: String(err) });
  }
});

// --- MCP transport ---

const transports = new Map<string, StreamableHTTPServerTransport>();

const extractToken = (req: express.Request): string | null => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.split(' ')[1];
};

app.post('/mcp', (req, res, next) => {
  if (isInitializeRequest(req.body)) return next();
  requireAuth(req, res, next);
}, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  const token = extractToken(req);

  if (sessionId && token) {
    const pendingRefresh = pendingRefreshTokens.get(token);
    if (pendingRefresh) pendingRefreshTokens.delete(token);
    setToken(sessionId, token, pendingRefresh);
  }

  if (sessionId && transports.has(sessionId)) {
    await transports.get(sessionId)!.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse, req.body);
    return;
  }

  if (isInitializeRequest(req.body)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, transport);
        if (token) setToken(id, token);
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId);
        removeSession(transport.sessionId);
      }
    };

    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse, req.body);
    return;
  }

  res.status(400).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Invalid or missing session' },
    id: null,
  });
});

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (transport) {
    await transport.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);
  } else {
    res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Invalid session' }, id: null });
  }
});

app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (transport) {
    await transport.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);
  } else {
    res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Invalid session' }, id: null });
  }
});

app.listen(config.port, () => {
  console.log(`atlas-mcp running on port ${config.port}`);
});
