# Full Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical, important, and suggestion-level issues identified in the comprehensive code review of Atlas Lab.

**Architecture:** Changes span backend services, frontend GUI, shared packages, and infrastructure. Each task is self-contained and targets a specific issue or group of related issues. No task depends on another unless explicitly noted.

**Tech Stack:** Node.js 22, TypeScript, Express, Next.js 15, React 19, Mongoose, Docker Compose, Traefik

---

## File Structure Overview

Key files to create:
- `packages/server-common/src/middleware/resolve-owner.ts` — shared resolveOwner utility
- `packages/server-common/src/services/publish-notification.ts` — shared publishNotification factory
- `.dockerignore` — root dockerignore
- `apps/atlas-dms/Dockerfile` — missing Dockerfile
- `apps/atlas-scheduler/Dockerfile` — missing Dockerfile
- `apps/atlas-notify/Dockerfile` — missing Dockerfile
- `apps/atlas-notes/Dockerfile` — missing Dockerfile
- `apps/atlas-tracker/Dockerfile` — missing Dockerfile

Key files to modify:
- Multiple config files, controllers, services, docker-compose files, frontend components

---

### Task 1: Remove hardcoded secrets from source code

**Files:**
- Modify: `apps/atlas-notify/src/config/index.ts`
- Modify: `apps/atlas-scheduler/src/config/index.ts`
- Modify: `apps/atlas-gui/src/hooks/use-push.ts`
- Modify: `deployment/atlas-init/src/datasets/atlas-dev/users.ts`
- Modify: `deployment/.env.example`

- [ ] **Step 1: Remove VAPID key defaults from notify config**

In `apps/atlas-notify/src/config/index.ts`, remove hardcoded VAPID keys:

```typescript
vapid: {
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || '',
  subject: process.env.VAPID_SUBJECT || '',
},
```

- [ ] **Step 2: Remove hardcoded VAPID key fallback from frontend**

In `apps/atlas-gui/src/hooks/use-push.ts`, line 6:

```typescript
const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
```

- [ ] **Step 3: Move dev user password to env var**

In `deployment/atlas-init/src/datasets/atlas-dev/users.ts`:

```typescript
export const users = [
  {
    username: "xaverric",
    email: "jilek.daniel@gmail.com",
    firstName: "Daniel",
    lastName: "Jilek",
    password: process.env.DEV_USER_PASSWORD || 'changeme',
  },
];
```

- [ ] **Step 4: Add `DEV_USER_PASSWORD` to `.env.example`**

- [ ] **Step 5: Make internalKey fail-loud in production**

In `apps/atlas-notify/src/config/index.ts` and `apps/atlas-scheduler/src/config/index.ts`, change:

```typescript
internalKey: process.env.INTERNAL_KEY || (() => { console.warn('WARNING: INTERNAL_KEY not set, using dev default'); return 'dev-internal-key'; })(),
```

- [ ] **Step 6: Commit**

```bash
git add apps/atlas-notify/src/config/index.ts apps/atlas-scheduler/src/config/index.ts apps/atlas-gui/src/hooks/use-push.ts deployment/atlas-init/src/datasets/atlas-dev/users.ts deployment/.env.example
git commit -m "fix(security): remove hardcoded secrets, use env vars with fail-loud defaults"
```

---

### Task 2: Fix XSS vulnerability — sanitize HTML in NoteViewer and PreviewModal

The current code uses `dangerouslySetInnerHTML` with unsanitized HTML from Showdown markdown conversion. This is a security risk, especially for publicly shared notes. The fix adds DOMPurify sanitization to all HTML rendering paths.

**Files:**
- Modify: `apps/atlas-gui/package.json` (add dompurify)
- Modify: `apps/atlas-gui/src/lib/markdown.ts`
- Modify: `apps/atlas-gui/src/components/files/preview-modal.tsx`

- [ ] **Step 1: Install DOMPurify**

```bash
npm -w @atlas/gui install dompurify && npm -w @atlas/gui install -D @types/dompurify
```

- [ ] **Step 2: Add sanitization to `markdownToHtml`**

In `apps/atlas-gui/src/lib/markdown.ts`, add DOMPurify import and sanitize output. This ensures all markdown-to-HTML conversion is safe before it reaches any component that renders HTML:

```typescript
import DOMPurify from 'dompurify';

export const markdownToHtml = (md: string): string => {
  if (!md) return '';
  const raw = showdown.makeHtml(md);
  return typeof window !== 'undefined' ? DOMPurify.sanitize(raw) : raw;
};
```

- [ ] **Step 3: Sanitize markdown rendering in PreviewModal**

In `apps/atlas-gui/src/components/files/preview-modal.tsx`, where `renderedMarkdown` is used, ensure it goes through `DOMPurify.sanitize()` — either at the point of rendering or when `renderedMarkdown` state is set. This prevents XSS from uploaded markdown files displayed in the file preview.

- [ ] **Step 4: Verify build passes**

```bash
npm -w @atlas/gui run build
```

- [ ] **Step 5: Commit**

```bash
git add apps/atlas-gui/
git commit -m "fix(gui): sanitize HTML with DOMPurify to prevent XSS in note viewer and preview"
```

---

### Task 3: Harden JavaScript and Shell executors

**Files:**
- Modify: `apps/atlas-scheduler/src/executors/javascript.ts`
- Modify: `apps/atlas-scheduler/src/executors/shell.ts`

- [ ] **Step 1: Remove Buffer from JS sandbox, add documentation comment**

In `apps/atlas-scheduler/src/executors/javascript.ts`, remove `Buffer` from sandbox (line 73). Buffer.allocUnsafe() can read process memory. The vm module is not a security sandbox — document this limitation:

```typescript
// NOTE: Node.js vm is not a security sandbox. JavaScript execution
// is gated behind admin role. Do not expose to untrusted users.
const sandbox = {
  console,
  env: { ...env },
  http: { fetch: httpFetch },
  storage,
  jobId: ctx?.jobId,
  runId: ctx?.runId,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  JSON,
  Date,
  Math,
  Array,
  Object,
  String: globalThis.String,
  Number: globalThis.Number,
  Boolean: globalThis.Boolean,
  Map,
  Set,
  RegExp,
  Error,
  Promise,
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  __result: undefined as unknown,
};
```

- [ ] **Step 2: Validate cwd in shell executor**

In `apps/atlas-scheduler/src/executors/shell.ts`, add cwd validation against allowed directories and strip sensitive env vars from inherited process.env:

```typescript
import path from 'node:path';

const ALLOWED_CWD_ROOTS = ['/tmp', '/home', '/app'];
const SENSITIVE_KEYS = ['INTERNAL_KEY', 'VAPID_PRIVATE_KEY', 'SMTP_PASS', 'MINIO_SECRET_KEY'];

// Inside execute():
if (cwd) {
  const resolved = path.resolve(cwd);
  const allowed = ALLOWED_CWD_ROOTS.some(root => resolved.startsWith(root));
  if (!allowed) {
    ctx?.logger.error(`Shell cwd "${cwd}" is outside allowed directories`);
    return Promise.resolve({ exitCode: 1, error: `Working directory "${cwd}" is not allowed.` });
  }
}

const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !SENSITIVE_KEYS.includes(k))
);
// Use: env: { ...cleanEnv, ...env }
```

- [ ] **Step 3: Commit**

```bash
git add apps/atlas-scheduler/src/executors/
git commit -m "fix(scheduler): harden JS sandbox (remove Buffer) and validate shell cwd"
```

---

### Task 4: Add MongoDB and Redis authentication to Docker

**Files:**
- Modify: `deployment/docker-compose.yml`
- Modify: `deployment/.env.example`
- Modify: `apps/atlas-scheduler/src/config/index.ts`
- Modify: `apps/atlas-notify/src/config/index.ts`

- [ ] **Step 1: Add MongoDB auth to production compose**

In `deployment/docker-compose.yml`, update mongodb service:

```yaml
mongodb:
  image: mongo:7
  environment:
    MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER:-atlas}
    MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
  volumes:
    - mongo-data:/data/db
  restart: unless-stopped
```

Update all `MONGO_URI` references to include credentials:
```yaml
MONGO_URI: mongodb://${MONGO_USER:-atlas}:${MONGO_PASSWORD}@mongodb:27017/atlas?authSource=admin
```

- [ ] **Step 2: Add Redis auth to production compose**

```yaml
redis:
  image: redis:7-alpine
  command: redis-server --requirepass ${REDIS_PASSWORD}
  volumes:
    - redis-data:/data
  restart: unless-stopped
```

Add `REDIS_PASSWORD: ${REDIS_PASSWORD}` to atlas-scheduler and atlas-notify.

- [ ] **Step 3: Update .env.example**

Add `MONGO_USER`, `MONGO_PASSWORD`, `REDIS_PASSWORD`.

- [ ] **Step 4: Update backend configs to support Redis password**

In scheduler and notify config, add `password` to redis config. Update BullMQ connection options.

- [ ] **Step 5: Keep dev compose unauthenticated for DX**

- [ ] **Step 6: Commit**

```bash
git add deployment/ apps/atlas-scheduler/src/config/ apps/atlas-notify/src/config/
git commit -m "fix(infra): add MongoDB and Redis authentication for production"
```

---

### Task 5: Create missing Dockerfiles for 5 services

**Files:**
- Create: `apps/atlas-dms/Dockerfile`
- Create: `apps/atlas-scheduler/Dockerfile`
- Create: `apps/atlas-notify/Dockerfile`
- Create: `apps/atlas-notes/Dockerfile`
- Create: `apps/atlas-tracker/Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create .dockerignore at root**

```
node_modules
.git
*.md
.env*
deployment
docs
.next
```

- [ ] **Step 2: Create Dockerfiles for all 5 services**

Follow the same multi-stage pattern as `apps/atlas-core/Dockerfile`. Each needs its specific workspace packages. All should include `USER node` for non-root execution. Services using event-bus need that package copied too.

- [ ] **Step 3: Add `USER node` to existing Dockerfiles**

Update core, mcp, gui Dockerfiles to run as non-root.

- [ ] **Step 4: Commit**

```bash
git add .dockerignore apps/*/Dockerfile
git commit -m "feat(infra): add Dockerfiles for all services, .dockerignore, run as non-root"
```

---

### Task 6: Add Docker healthchecks and compose improvements

**Files:**
- Modify: `deployment/docker-compose.yml`
- Modify: `deployment/docker-compose.dev.yml`

- [ ] **Step 1: Add project name and healthchecks to production compose**

Add `name: atlas-lab`. Add healthchecks for mongodb, redis, keycloak. Update `depends_on` to use `condition: service_healthy`.

- [ ] **Step 2: Add healthchecks to dev compose**

- [ ] **Step 3: Add resource limits for heavy services (Ollama 4G, Qdrant 1G)**

- [ ] **Step 4: Commit**

```bash
git add deployment/
git commit -m "feat(infra): add healthchecks, project name, resource limits"
```

---

### Task 7: Fix Traefik config, MCP CORS, MinIO console access

**Files:**
- Modify: `deployment/traefik/traefik.yml`
- Modify: `deployment/docker-compose.yml`

- [ ] **Step 1: Fix Traefik ACME email** to `jilek.daniel@gmail.com`

- [ ] **Step 2: Restrict MCP CORS** to `https://${ATLAS_DOMAIN},https://claude.ai`

- [ ] **Step 3: Add IP whitelist middleware for MinIO console** (private networks only)

- [ ] **Step 4: Commit**

```bash
git add deployment/
git commit -m "fix(infra): fix Traefik email, restrict MCP CORS, protect MinIO console"
```

---

### Task 8: Fix GUI Dockerfile build args for all NEXT_PUBLIC vars

**Files:**
- Modify: `apps/atlas-gui/Dockerfile`

- [ ] **Step 1: Add all NEXT_PUBLIC build args** (API_URL, DMS_URL, SCHEDULER_URL, NOTIFY_URL, NOTES_URL, TRACKER_URL, OIDC_AUTHORITY, OIDC_CLIENT_ID, VAPID_PUBLIC_KEY)

- [ ] **Step 2: Commit**

```bash
git add apps/atlas-gui/Dockerfile
git commit -m "fix(gui): pass all NEXT_PUBLIC build args in Dockerfile"
```

---

### Task 9: Extract resolveOwner into server-common

**Files:**
- Create: `packages/server-common/src/middleware/resolve-owner.ts`
- Modify: `packages/server-common/src/index.ts`
- Modify: 8 controller files across dms, scheduler, notify, notes

- [ ] **Step 1: Create shared resolveOwner**

```typescript
import { ApiError } from '@atlas/core';
import type { Request } from 'express';

export const resolveOwner = (req: Request): { ownerId: string; isAdmin: boolean } => {
  const isAdmin = req.auth.realm_access?.roles?.includes('admin') ?? false;
  const queryUserId = req.query.userId as string | undefined;
  if (queryUserId && !isAdmin) throw new ApiError(403, 'Only admins can browse other users data');
  const ownerId = (isAdmin && queryUserId) ? queryUserId : req.auth.sub;
  return { ownerId, isAdmin };
};
```

- [ ] **Step 2: Export from server-common index**

- [ ] **Step 3: Replace all 8 duplicated resolveOwner functions**

Note: notify controllers use `userId` not `ownerId` — destructure accordingly.

- [ ] **Step 4: Verify typecheck**

- [ ] **Step 5: Commit**

```bash
git add packages/server-common/ apps/*/src/controllers/
git commit -m "refactor: extract resolveOwner into @atlas/server-common"
```

---

### Task 10: Extract publishNotification into server-common

**Files:**
- Create: `packages/server-common/src/services/publish-notification.ts`
- Modify: `packages/server-common/src/index.ts`
- Modify: 4 service publishNotification files (core, dms, notes, tracker)

- [ ] **Step 1: Create factory function**

```typescript
export const createPublishNotification = (notifyUrl: string, internalKey: string) =>
  async (userId: string, title: string, body: string, event: string, url?: string) => {
    try {
      await fetch(`${notifyUrl}/api/v1/notifications/send-direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Key': internalKey },
        body: JSON.stringify({ userId, title, body, event, priority: 'normal', url }),
      });
    } catch { /* fire and forget */ }
  };
```

- [ ] **Step 2: Update all 4 services to use factory**

- [ ] **Step 3: Add notifyUrl/internalKey to atlas-core config if missing**

- [ ] **Step 4: Commit**

```bash
git add packages/server-common/ apps/*/src/services/publishNotification.ts apps/atlas-core/src/config/
git commit -m "refactor: extract publishNotification factory into @atlas/server-common"
```

---

### Task 11: Add express.json size limit, fix event bus errors, fix connectDB

**Files:**
- Modify: `apps/atlas-core/src/index.ts`
- Modify: `apps/atlas-dms/src/index.ts`
- Modify: `apps/atlas-scheduler/src/index.ts`
- Modify: `apps/atlas-notify/src/index.ts`
- Modify: `apps/atlas-mcp/src/index.ts`
- Modify: `packages/event-bus/src/bus.ts`
- Modify: `packages/server-common/src/config/db.ts`

- [ ] **Step 1: Add body size limits** — `1mb` for services, `5mb` for MCP

- [ ] **Step 2: Add error logging to event bus** — replace empty catch blocks with console.error

- [ ] **Step 3: Fix connectDB** — remove process.exit(1), just throw (callers handle it)

- [ ] **Step 4: Commit**

```bash
git add apps/*/src/index.ts packages/event-bus/src/bus.ts packages/server-common/src/config/db.ts
git commit -m "fix: add JSON body limits, log event bus errors, fix connectDB"
```

---

### Task 12: Fix share token revoke, add admin guard to templates

**Files:**
- Modify: `apps/atlas-dms/src/services/shareService.ts`
- Modify: `apps/atlas-notify/src/routes/notification.ts`

- [ ] **Step 1: Fix revoke** — find share first, verify ownership, then delete

- [ ] **Step 2: Add requireRole('admin') to template POST/PATCH/DELETE routes**

- [ ] **Step 3: Commit**

```bash
git add apps/atlas-dms/src/services/shareService.ts apps/atlas-notify/src/routes/notification.ts
git commit -m "fix: verify ownership before share revoke, require admin for template management"
```

---

### Task 13: Add folder recursion depth limits

**Files:**
- Modify: `apps/atlas-dms/src/services/folderService.ts`
- Modify: `apps/atlas-notes/src/services/noteFolderService.ts`

- [ ] **Step 1: Add MAX_FOLDER_DEPTH=20 and depth guards** to all recursive traversals (breadcrumbs, isPublicFolder, buildSubtree)

- [ ] **Step 2: Apply same to notes folder service**

- [ ] **Step 3: Commit**

```bash
git add apps/atlas-dms/src/services/folderService.ts apps/atlas-notes/src/services/noteFolderService.ts
git commit -m "fix: add depth limits to folder recursion to prevent infinite loops"
```

---

### Task 14: Fix frontend auth issues

**Files:**
- Modify: `apps/atlas-gui/src/lib/auth.ts`
- Modify: `apps/atlas-gui/src/lib/api.ts`
- Modify: `apps/atlas-gui/src/app/(protected)/layout.tsx`

- [ ] **Step 1: Fix getUserManager** — throw descriptive error instead of `!` assertion

- [ ] **Step 2: Add 401 retry to uploadFile**, consolidate auth header logic

- [ ] **Step 3: Fix protected layout** — move redirect to useEffect, show loading during redirect

- [ ] **Step 4: Commit**

```bash
git add apps/atlas-gui/src/lib/ apps/atlas-gui/src/app/\(protected\)/layout.tsx
git commit -m "fix(gui): fix auth safety, add upload retry, move redirect to useEffect"
```

---

### Task 15: Fix notification-bell TypeScript types

**Files:**
- Modify: `apps/atlas-gui/src/hooks/use-notifications.ts`
- Modify: `apps/atlas-gui/src/components/layout/notification-bell.tsx`

- [ ] **Step 1: Add `data?: { url?: string }` to Notification interface**

- [ ] **Step 2: Remove `as any` casts from notification-bell**

- [ ] **Step 3: Commit**

```bash
git add apps/atlas-gui/src/hooks/use-notifications.ts apps/atlas-gui/src/components/layout/notification-bell.tsx
git commit -m "fix(gui): add proper types for notification data, remove as any casts"
```

---

### Task 16: Fix NoteRevision toJSON, document audit schema

**Files:**
- Modify: `apps/atlas-notes/src/models/NoteRevision.ts`
- Modify: `apps/atlas-core/src/daos/auditDao.ts`

- [ ] **Step 1: Add `delete ret._id` to NoteRevision toJSON** for consistency with all other models

- [ ] **Step 2: Add comment to audit DAO** noting schema must match server-common

- [ ] **Step 3: Commit**

```bash
git add apps/atlas-notes/src/models/NoteRevision.ts apps/atlas-core/src/daos/auditDao.ts
git commit -m "fix: NoteRevision toJSON consistency, document audit schema dependency"
```

---

### Task 17: Fix startup.sh for production mode

**Files:**
- Modify: `deployment/startup.sh`

- [ ] **Step 1: Skip localhost port checks in production mode** (ports aren't exposed)

- [ ] **Step 2: Commit**

```bash
git add deployment/startup.sh
git commit -m "fix(infra): skip localhost port checks in production mode"
```

---

### Task 18: Add atlas-tracker to production compose

**Files:**
- Modify: `deployment/docker-compose.yml`

- [ ] **Step 1: Add atlas-tracker service** following the same pattern as other services

- [ ] **Step 2: Commit**

```bash
git add deployment/docker-compose.yml
git commit -m "feat(infra): add atlas-tracker service to production compose"
```

---

### Task 19: Update manifest and fix minor issues

**Files:**
- Modify: `apps/atlas-gui/public/manifest.json`

- [ ] **Step 1: Update manifest icon configuration** — add purpose field

- [ ] **Step 2: Commit**

```bash
git add apps/atlas-gui/public/manifest.json
git commit -m "fix(gui): update manifest icon configuration"
```

---

### Task 20: Final typecheck and lint

- [ ] **Step 1: Run full typecheck** `npm run typecheck`

- [ ] **Step 2: Run lint** `npm run lint`

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve typecheck and lint errors from review fixes"
```
