# 10 — MCP Server

## Current State

- No MCP (Model Context Protocol) server
- DMS has full file CRUD API
- Notes has full CRUD + vector search API
- Both services have REST APIs behind Keycloak auth

## Goals

Build an MCP server that exposes atlas DMS and Notes functionality as tools for AI assistants (Claude, etc.). This enables AI to upload/read files, write/read notes, and search the knowledge base programmatically.

### Business Case

- Use Claude Desktop (or any MCP client) to interact with atlas documents and notes
- AI can store findings/results in atlas notes
- AI can search notes as a knowledge base
- AI can upload/download files from DMS
- Unified tool interface for AI-powered workflows

## Architecture

### Standalone MCP Server

`packages/atlas-mcp/` (or `apps/atlas-mcp/`):
```
packages/atlas-mcp/
  src/
    index.ts              — MCP server entry point
    config.ts             — API URLs, auth config
    tools/
      dms.ts              — DMS tools (upload, download, list, search)
      notes.ts            — Notes tools (create, read, update, search)
      folders.ts          — Folder tools (create, list, navigate)
    client/
      api.ts              — HTTP client for atlas APIs
      auth.ts             — Keycloak token management
  package.json
  tsconfig.json
```

### MCP Server Setup

`packages/atlas-mcp/src/index.ts`:
```
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'atlas-mcp',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Register tools
registerDmsTools(server);
registerNotesTools(server);
registerFolderTools(server);

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Tool Definitions

#### DMS Tools

**`dms_list_folders`** — List folders in DMS
```
Input: { parentId?: string }
Output: Array of { id, name, createdAt, itemCount }
```

**`dms_list_documents`** — List documents in a folder
```
Input: { folderId: string, search?: string }
Output: Array of { id, filename, mimeType, size, createdAt }
```

**`dms_upload_document`** — Upload a file
```
Input: { folderId: string, filename: string, content: string (base64), mimeType: string }
Output: { id, filename, url }
```

**`dms_download_document`** — Download/read a file
```
Input: { documentId: string }
Output: { filename, mimeType, content: string (base64 or text) }
```

**`dms_search_documents`** — Search documents by name
```
Input: { query: string, folderId?: string }
Output: Array of matching documents
```

**`dms_create_folder`** — Create a folder
```
Input: { name: string, parentId?: string }
Output: { id, name }
```

**`dms_get_share_link`** — Get presigned URL for a document
```
Input: { documentId: string, expiresInHours?: number }
Output: { url, expiresAt }
```

#### Notes Tools

**`notes_list_folders`** — List note folders
```
Input: { parentId?: string }
Output: Array of { id, name, noteCount }
```

**`notes_list`** — List notes in a folder
```
Input: { folderId?: string, search?: string }
Output: Array of { id, title, excerpt, tags, updatedAt }
```

**`notes_read`** — Read a note's full content
```
Input: { noteId: string }
Output: { id, title, content (markdown), tags, metadata }
```

**`notes_create`** — Create a new note
```
Input: { title: string, content: string (markdown), folderId?: string, tags?: string[] }
Output: { id, title }
```

**`notes_update`** — Update an existing note
```
Input: { noteId: string, title?: string, content?: string, tags?: string[] }
Output: { id, title, updatedAt }
```

**`notes_search`** — Semantic search across notes
```
Input: { query: string, limit?: number }
Output: Array of { id, title, excerpt, score }
```

**`notes_create_folder`** — Create a note folder
```
Input: { name: string, parentId?: string }
Output: { id, name }
```

### Authentication

The MCP server needs to authenticate with atlas APIs. Two options:

#### A. API Key (simpler)
- Generate long-lived API key for MCP access
- Store in MCP config
- Backend validates via `X-Api-Key` header (notes already supports this)
- Extend API key auth to DMS

#### B. Keycloak Service Account
- Create service account in Keycloak for MCP
- MCP server obtains token via client credentials grant
- Token refresh handled automatically

**Recommended: Start with API Key (A)**, extend Keycloak service account later.

`packages/atlas-mcp/src/client/auth.ts`:
```
class AtlasAuth {
  constructor(private apiKey: string) {}

  getHeaders(): Record<string, string> {
    return { 'X-Api-Key': this.apiKey };
  }
}
```

### HTTP Client

`packages/atlas-mcp/src/client/api.ts`:
```
class AtlasClient {
  constructor(
    private baseUrls: { core: string, dms: string, notes: string },
    private auth: AtlasAuth
  ) {}

  async request(service: 'core' | 'dms' | 'notes', method: string, path: string, body?: any) {
    const url = `${this.baseUrls[service]}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...this.auth.getHeaders()
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) throw new Error(`Atlas API error: ${res.status}`);
    return res.json();
  }
}
```

### Configuration

`packages/atlas-mcp/src/config.ts`:
```
export const config = {
  ATLAS_CORE_URL: process.env.ATLAS_CORE_URL || 'http://localhost:4000',
  ATLAS_DMS_URL: process.env.ATLAS_DMS_URL || 'http://localhost:4001',
  ATLAS_NOTES_URL: process.env.ATLAS_NOTES_URL || 'http://localhost:4004',
  ATLAS_API_KEY: process.env.ATLAS_API_KEY || ''
};
```

### Claude Desktop Integration

`~/.claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "atlas": {
      "command": "npx",
      "args": ["tsx", "/path/to/atlas-lab/packages/atlas-mcp/src/index.ts"],
      "env": {
        "ATLAS_CORE_URL": "https://api.xaverric.cz",
        "ATLAS_DMS_URL": "https://dms.xaverric.cz",
        "ATLAS_NOTES_URL": "https://notes.xaverric.cz",
        "ATLAS_API_KEY": "your-api-key"
      }
    }
  }
}
```

### DMS API Key Auth Extension

Currently only notes supports `X-Api-Key`. Extend to DMS:

`apps/atlas-dms/src/middleware/apiKeyAuth.ts` (copy pattern from atlas-notes):
```
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === config.API_KEY) {
    req.auth = { sub: 'mcp-service', name: 'MCP Server', roles: ['service'] };
    return next();
  }
  next();  // fall through to JWT auth
}
```

Use as optional pre-auth: try API key first, fall back to JWT.

## Implementation Order

1. **MCP server scaffold** — package setup, MCP SDK, stdio transport
2. **Notes tools** — list, read, create, update, search (notes already has API key auth)
3. **DMS API key auth** — extend DMS to accept API key
4. **DMS tools** — list, upload, download, search, share links
5. **Folder tools** — both DMS and notes folder operations
6. **Claude Desktop config** — test with Claude Desktop
7. **Documentation** — usage guide, tool descriptions

## Dependencies

- `@modelcontextprotocol/sdk` package
- Atlas services must be running and accessible
- API key generation (manual for now, could add admin UI later)
- DMS needs API key auth middleware (new)
- Notes API key auth already exists
