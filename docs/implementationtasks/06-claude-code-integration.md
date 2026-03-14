# 06 — Claude Code Integration

## Current State

- No AI/Claude integration in the platform yet
- Atlas platform runs on VPS with Docker infrastructure
- Keycloak authentication available for securing the interface

## Goals

Build a web-based Claude Code interface accessible at `/claude` within the atlas-gui, backed by Claude Agents SDK running in Docker sandboxes for safe execution.

### 1. Web Chat Interface

**Requirements:**
- Route: `/claude` in atlas-gui (protected, requires authentication)
- Standard chat UI: message list, input area, send button
- Support text input and image upload (multimodal)
- Display assistant responses with markdown rendering
- Show tool calls and their results (expandable/collapsible)
- Chat history — list of past conversations, ability to return to them
- New chat button
- Permission toggle: skip permissions mode (only when sandbox is active)

**GUI implementation:**

`apps/atlas-gui/src/app/(protected)/claude/page.tsx` — main chat page:
- Chat list sidebar (conversation history)
- Active chat area
- Message input with image attach button

`apps/atlas-gui/src/app/(protected)/claude/[chatId]/page.tsx` — specific chat:
- Load chat history from backend
- Continue conversation

`apps/atlas-gui/src/components/claude/`:
```
chat-message.tsx      — renders user/assistant messages
chat-input.tsx        — text input + image upload + send
chat-sidebar.tsx      — conversation list + new chat button
tool-call-display.tsx — shows tool name, input, output (collapsible)
chat-settings.tsx     — permission toggle, model selection
code-block.tsx        — syntax highlighted code in responses
```

**Message rendering:**
- User messages: text + optional images
- Assistant messages: markdown with code blocks, inline tool calls
- Tool calls: show as expandable blocks between message parts
  - Header: tool name + status (running/success/error)
  - Body: input parameters + output (collapsible)
- Streaming: SSE for real-time response streaming

### 2. Backend — Claude Agent Service

**New service: `atlas-claude`** or integrate into atlas-core.

**Recommended: New service** at port 4005.

`apps/atlas-claude/`:
```
src/
  config/index.ts
  models/
    Chat.ts              — chat session (userId, title, createdAt)
    ChatMessage.ts       — individual messages (chatId, role, content, toolCalls)
  controllers/
    chatController.ts    — CRUD for chats, send message
  services/
    chatService.ts       — orchestrates Claude API calls
    sandboxService.ts    — manages Docker sandbox lifecycle
  daos/
    chatDao.ts
    chatMessageDao.ts
  routes/
    index.ts
    chat.ts
    health.ts
  middleware/
    auth.ts
  index.ts
```

**API design:**
```
GET    /api/v1/claude/chats              — list user's chats
POST   /api/v1/claude/chats              — create new chat
GET    /api/v1/claude/chats/:id          — get chat with messages
DELETE /api/v1/claude/chats/:id          — delete chat
POST   /api/v1/claude/chats/:id/messages — send message (returns SSE stream)
PUT    /api/v1/claude/chats/:id/settings — update chat settings (permissions, model)
```

**Chat model:**
```
{
  userId: string,
  title: string,          // auto-generated from first message
  model: string,          // claude-sonnet-4-6, claude-opus-4-6, etc.
  sandboxEnabled: boolean,
  skipPermissions: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Message model:**
```
{
  chatId: ObjectId,
  role: 'user' | 'assistant' | 'tool',
  content: [
    { type: 'text', text: string },
    { type: 'image', mediaType: string, data: string },  // base64
    { type: 'tool_use', id: string, name: string, input: object },
    { type: 'tool_result', tool_use_id: string, content: string }
  ],
  createdAt: Date
}
```

### 3. Claude Agents SDK Integration

**Package:** `@anthropic-ai/claude-agent-sdk` or direct Anthropic API with tool use.

**Approach:** Use Claude API with tool use definitions. The agent runs inside a Docker sandbox where tools execute system commands.

**Service implementation:**

`apps/atlas-claude/src/services/chatService.ts`:
```
import Anthropic from '@anthropic-ai/sdk';

class ChatService {
  private anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

  async sendMessage(chatId, userMessage, options) {
    const chat = await chatDao.findById(chatId);
    const history = await chatMessageDao.findByChatId(chatId);

    // Store user message
    await chatMessageDao.create({ chatId, role: 'user', content: userMessage });

    // Build messages array from history
    const messages = this.buildMessages(history, userMessage);

    // Create sandbox if enabled
    const sandbox = options.sandboxEnabled
      ? await sandboxService.getOrCreate(chatId)
      : null;

    // Stream response
    const stream = await this.anthropic.messages.stream({
      model: chat.model,
      max_tokens: 4096,
      messages,
      tools: sandbox ? this.getSandboxTools(sandbox) : this.getBasicTools(),
      system: this.getSystemPrompt(chat)
    });

    return stream;  // SSE to client
  }
}
```

**Tool definitions for sandboxed execution:**
```
tools: [
  {
    name: 'execute_command',
    description: 'Execute a shell command in the sandbox',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string' }
      },
      required: ['command']
    }
  },
  {
    name: 'read_file',
    description: 'Read a file from the sandbox filesystem',
    input_schema: { ... }
  },
  {
    name: 'write_file',
    description: 'Write content to a file in the sandbox',
    input_schema: { ... }
  },
  {
    name: 'list_files',
    description: 'List files in a directory',
    input_schema: { ... }
  }
]
```

### 4. Docker Sandbox for Safe Execution

**Reference:** Docker Sandboxes (https://www.docker.com/products/docker-sandboxes/) — microVM-based isolation for running coding agents safely.

**Two approaches:**

#### A. Docker-in-Docker with resource limits (simpler)
- Spin up a Docker container per chat session
- Mount limited workspace volume
- Network isolation (no access to host network)
- CPU/memory limits
- Auto-cleanup after idle timeout

#### B. Docker Sandboxes / microVM (more secure)
- Use Docker's sandbox API for microVM isolation
- True isolation from host
- Better security guarantees

**Recommended: Start with approach A**, migrate to B when Docker Sandboxes stabilize.

`apps/atlas-claude/src/services/sandboxService.ts`:
```
import Docker from 'dockerode';

class SandboxService {
  private docker = new Docker();
  private sandboxes = new Map<string, Container>();

  async getOrCreate(chatId: string): Promise<Sandbox> {
    if (this.sandboxes.has(chatId)) {
      return this.sandboxes.get(chatId);
    }

    const container = await this.docker.createContainer({
      Image: 'atlas-sandbox:latest',  // custom image with dev tools
      HostConfig: {
        Memory: 512 * 1024 * 1024,     // 512MB
        CpuQuota: 50000,                // 50% CPU
        NetworkMode: 'none',             // no network by default
        AutoRemove: true,
        ReadonlyRootfs: false,
        Tmpfs: { '/tmp': 'rw,noexec,nosuid,size=100m' }
      },
      Cmd: ['sleep', 'infinity']
    });

    await container.start();
    this.sandboxes.set(chatId, container);

    // Auto-cleanup after 30 min idle
    this.scheduleCleanup(chatId, 30 * 60 * 1000);

    return { container, exec: this.createExec(container) };
  }

  async executeCommand(chatId: string, command: string): Promise<string> {
    const sandbox = this.sandboxes.get(chatId);
    const exec = await sandbox.container.exec({
      Cmd: ['bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true
    });
    const stream = await exec.start({});
    return this.collectOutput(stream);
  }

  async cleanup(chatId: string): Promise<void> {
    const sandbox = this.sandboxes.get(chatId);
    if (sandbox) {
      await sandbox.container.stop();
      this.sandboxes.delete(chatId);
    }
  }
}
```

**Sandbox Docker image:**

`apps/atlas-claude/sandbox/Dockerfile`:
```dockerfile
FROM node:22-slim
RUN apt-get update && apt-get install -y \
  git curl wget python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g typescript tsx
WORKDIR /workspace
USER node
```

### 5. Chat History & Navigation

**Storage:** All chats and messages persisted in MongoDB.

**Features:**
- Chat list sorted by last activity
- Chat title auto-generated from first user message (or first 50 chars)
- Search across chat history
- Delete individual chats
- Chat metadata: message count, last active, model used

**GUI:**
- Left sidebar: chat list with titles and dates
- Click to load chat, scroll to bottom
- "New Chat" button at top
- Search bar in sidebar

### 6. Configuration

**Environment variables:**
```
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_DEFAULT_MODEL=claude-sonnet-4-6
CLAUDE_MAX_TOKENS=4096
SANDBOX_IMAGE=atlas-sandbox:latest
SANDBOX_MEMORY_LIMIT=536870912
SANDBOX_CPU_QUOTA=50000
SANDBOX_IDLE_TIMEOUT=1800000
SANDBOX_NETWORK=none
```

**Docker compose additions:**

```yaml
atlas-claude:
  build: ./apps/atlas-claude
  ports:
    - "4005:4005"
  environment:
    - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    - MONGODB_URI=mongodb://mongo:27017/atlas-claude
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock  # for Docker-in-Docker
  labels:
    - traefik.enable=true
    - traefik.http.routers.claude.rule=Host(`claude.${ATLAS_DOMAIN}`)
```

**Security:**
- Docker socket access is dangerous — consider using Docker Socket Proxy
- Rate limiting on message endpoint
- Max concurrent sandboxes per user
- Sandbox auto-cleanup on chat deletion

**GUI routing (atlas-gui):**

`apps/atlas-gui/src/lib/api.ts` — add routing:
```
if (path.startsWith('/api/v1/claude')) return CLAUDE_URL;
```

**Sidebar:**
- Add "Claude" menu item with chat icon

## Implementation Order

1. **Basic chat backend** — Chat/Message models, CRUD API, Anthropic API integration (no sandbox)
2. **Chat GUI** — message list, input, streaming responses
3. **Tool call display** — render tool uses in chat
4. **Docker sandbox** — container lifecycle, command execution
5. **Sandbox tools** — file read/write/list, command execution via sandbox
6. **Chat history** — persistence, sidebar navigation
7. **Permission toggle** — skip permissions with sandbox enforcement
8. **Image support** — multimodal input

## Dependencies

- Anthropic API key required
- Docker socket access for sandbox management
- New service (`atlas-claude`) needs Docker compose, Traefik config
- MongoDB database: `atlas-claude`
- No Redis needed (no queue — direct API calls)
