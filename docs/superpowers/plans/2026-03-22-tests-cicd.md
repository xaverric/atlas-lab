# Tests & CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix TypeScript errors, add Vitest test infrastructure with unit + smoke tests, and set up GitHub Actions CI/CD with Docker Hub image publishing and release management.

**Architecture:** Fix TS errors first, then extract Express app creation for testability, set up Vitest workspace, write tests per service, create GitHub Actions workflows for CI, build, nightly, and release.

**Tech Stack:** Vitest, supertest, Node 22, GitHub Actions, Docker Buildx, Docker Hub

---

## File Structure

### New files to create:
```
vitest.workspace.ts                              — workspace config
apps/atlas-core/vitest.config.ts                 — per-service config
apps/atlas-core/src/app.ts                       — extracted Express app
apps/atlas-core/__tests__/services/userService.test.ts
apps/atlas-core/__tests__/api/health.test.ts
apps/atlas-dms/vitest.config.ts
apps/atlas-dms/src/app.ts
apps/atlas-dms/__tests__/services/shareService.test.ts
apps/atlas-dms/__tests__/api/health.test.ts
apps/atlas-scheduler/vitest.config.ts
apps/atlas-scheduler/src/app.ts
apps/atlas-scheduler/__tests__/executors/shell.test.ts
apps/atlas-scheduler/__tests__/api/health.test.ts
apps/atlas-notify/vitest.config.ts
apps/atlas-notify/src/app.ts
apps/atlas-notify/__tests__/api/health.test.ts
apps/atlas-notes/vitest.config.ts
apps/atlas-notes/src/app.ts
apps/atlas-notes/__tests__/api/health.test.ts
packages/server-common/__tests__/resolve-owner.test.ts
packages/server-common/__tests__/require-role.test.ts
packages/event-bus/__tests__/match.test.ts
.github/workflows/ci.yml
.github/workflows/build.yml
.github/workflows/nightly.yml
.github/workflows/release.yml
```

### Files to modify:
```
apps/atlas-core/src/controllers/systemController.ts  — fix TS errors
apps/atlas-core/src/index.ts                         — import from app.ts
apps/atlas-core/src/config/db.ts                     — fix connectDB for core
apps/atlas-dms/src/index.ts                          — import from app.ts
apps/atlas-scheduler/src/index.ts                    — import from app.ts
apps/atlas-notify/src/index.ts                       — import from app.ts
apps/atlas-notes/src/index.ts                        — import from app.ts
apps/atlas-gui/src/app/(protected)/audit/page.tsx    — fix TS errors
apps/atlas-gui/src/app/(protected)/notifications/preferences/page.tsx
apps/atlas-gui/src/app/(protected)/scheduler/jobs/[id]/page.tsx
apps/atlas-gui/src/lib/dashboard-store.ts
apps/atlas-gui/src/components/notes/tiptap-editor.tsx
apps/atlas-gui/src/lib/auth.ts
deployment/docker-compose.yml                        — update image refs
package.json                                         — add test scripts
```

---

### Task 1: Fix TypeScript errors in systemController.ts

**Files:**
- Modify: `apps/atlas-core/src/controllers/systemController.ts`

- [ ] **Step 1: Fix all 10 TS errors**

Apply these fixes:
1. Cast `mongoose.connection.client` — add helper at top:
```typescript
const getClientDb = (name: string) =>
  (mongoose.connection as any).client.db(name);
```
Replace all 5 occurrences of `mongoose.connection.client.db('...')` with `getClientDb('...')`.

2. Fix `sizeOnDisk` (lines 53-54): change `db.sizeOnDisk` to `db.sizeOnDisk ?? 0`

3. Fix implicit any in `.map` callbacks (lines 198, 224): add `(d: any)` and `(n: any)` type annotations

4. Fix string[] index (line 238): change to:
```typescript
const dbName = SECTION_DB_MAP[section as string];
```

- [ ] **Step 2: Verify typecheck**

Run: `npm -w @atlas/server run typecheck`
Expected: 0 errors in this file

- [ ] **Step 3: Commit**

```bash
git add apps/atlas-core/src/controllers/systemController.ts
git commit -m "fix(core): resolve TypeScript errors in systemController"
```

---

### Task 2: Fix TypeScript errors in GUI components

**Files:**
- Modify: `apps/atlas-gui/src/app/(protected)/audit/page.tsx`
- Modify: `apps/atlas-gui/src/app/(protected)/notifications/preferences/page.tsx`
- Modify: `apps/atlas-gui/src/app/(protected)/scheduler/jobs/[id]/page.tsx`
- Modify: `apps/atlas-gui/src/lib/dashboard-store.ts`
- Modify: `apps/atlas-gui/src/components/notes/tiptap-editor.tsx`
- Modify: `apps/atlas-gui/src/lib/auth.ts`

- [ ] **Step 1: Fix audit/page.tsx (3 errors)**

The `event.error`, `event.request`, `event.result`, `event.details` are typed as `unknown`. Wrap in `String(...)` for error and `JSON.stringify(...)` for objects. Find the event interface in the same file and add proper types:
```typescript
error?: string;
request?: Record<string, unknown>;
result?: Record<string, unknown>;
details?: Record<string, unknown>;
```

- [ ] **Step 2: Fix preferences/page.tsx (2 errors)**

Add `disabled?: boolean` to the CHANNEL_TYPES array element type. Find the array definition (around line 15) and add explicit type:
```typescript
const CHANNEL_TYPES: Array<{ value: string; label: string; configField: string | null; placeholder: string; disabled?: boolean }> = [
```

- [ ] **Step 3: Fix scheduler/jobs/[id]/page.tsx (3 errors) + dashboard-store.ts**

Add convenience methods to `dashboard-store.ts`:
```typescript
hasItem(resourceId: string): boolean {
  return read().some((w) => w.config.jobId === resourceId || w.id === resourceId);
},

addItem(resourceId: string, name: string): DashboardWidget {
  return dashboardStore.addWidget({ type: 'job', title: name, config: { jobId: resourceId }, size: 'sm' });
},

removeItem(resourceId: string): void {
  const widget = read().find((w) => w.config.jobId === resourceId);
  if (widget) dashboardStore.removeWidget(widget.id);
},
```

- [ ] **Step 4: Fix tiptap-editor.tsx (1 error)**

Change line 75 from:
```typescript
editor.commands.setContent(content, false);
```
To:
```typescript
editor.commands.setContent(content, { emitUpdate: false });
```

- [ ] **Step 5: Fix auth.ts (1 error)**

Change the `parseJwtPayload` return type cast. In `loginWithCredentials`, line 58:
```typescript
profile: parseJwtPayload(tokens.id_token) as any,
```

- [ ] **Step 6: Verify zero TS errors**

Run: `npm run typecheck`
Expected: 0 errors total

- [ ] **Step 7: Commit**

```bash
git add apps/atlas-gui/
git commit -m "fix(gui): resolve all TypeScript errors in GUI components"
```

---

### Task 3: Install Vitest and set up workspace

**Files:**
- Modify: `package.json`
- Create: `vitest.workspace.ts`
- Create: per-service `vitest.config.ts` (6 files)

- [ ] **Step 1: Install vitest + supertest**

```bash
npm install -D vitest @vitest/coverage-v8 supertest @types/supertest
```

- [ ] **Step 2: Add test scripts to root package.json**

Add to scripts:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 3: Create vitest.workspace.ts**

```typescript
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/atlas-core/vitest.config.ts',
  'apps/atlas-dms/vitest.config.ts',
  'apps/atlas-scheduler/vitest.config.ts',
  'apps/atlas-notify/vitest.config.ts',
  'apps/atlas-notes/vitest.config.ts',
  'packages/server-common/vitest.config.ts',
  'packages/event-bus/vitest.config.ts',
]);
```

- [ ] **Step 4: Create vitest.config.ts for each workspace**

Template (same for each, adjust name):
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'atlas-core', // change per service
    root: '.',
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
```

Create for: `apps/atlas-core`, `apps/atlas-dms`, `apps/atlas-scheduler`, `apps/atlas-notify`, `apps/atlas-notes`, `packages/server-common`, `packages/event-bus`.

- [ ] **Step 5: Verify vitest discovers workspaces**

```bash
npx vitest --run
```
Expected: "No test files found" (but no config errors)

- [ ] **Step 6: Commit**

```bash
git add vitest.workspace.ts apps/*/vitest.config.ts packages/*/vitest.config.ts package.json package-lock.json
git commit -m "feat: set up Vitest workspace infrastructure"
```

---

### Task 4: Extract Express app for testability

**Files:**
- Create: `apps/atlas-core/src/app.ts`
- Modify: `apps/atlas-core/src/index.ts`
- Create: `apps/atlas-dms/src/app.ts`
- Modify: `apps/atlas-dms/src/index.ts`
- Create: `apps/atlas-scheduler/src/app.ts`
- Modify: `apps/atlas-scheduler/src/index.ts`
- Create: `apps/atlas-notify/src/app.ts`
- Modify: `apps/atlas-notify/src/index.ts`
- Create: `apps/atlas-notes/src/app.ts`
- Modify: `apps/atlas-notes/src/index.ts`

- [ ] **Step 1: Extract atlas-core app**

Create `apps/atlas-core/src/app.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createAuditMiddleware } from '@atlas/server-common';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';

export const createApp = () => {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(createAuditMiddleware('atlas-core', config.auditMongoUri));
  app.use(routes);
  app.use(errorHandler);
  return app;
};
```

Update `apps/atlas-core/src/index.ts`:
```typescript
import { connectDB } from './config/db.js';
import { logAuditEvent } from '@atlas/server-common';
import { config } from './config/index.js';
import * as auditDao from './daos/auditDao.js';
import { createApp } from './app.js';

const app = createApp();

const start = async () => {
  await connectDB();
  await auditDao.connect(config.auditMongoUri);
  app.listen(config.port, () => {
    console.log(`atlas-core running on port ${config.port}`);
    logAuditEvent(config.auditMongoUri, {
      service: 'atlas-core', action: 'service.started', category: 'system',
      details: { version: process.env.APP_VERSION || 'dev', nodeVersion: process.version, uptime: process.uptime() },
    });
  });
};

start();
```

- [ ] **Step 2: Extract atlas-dms, atlas-scheduler, atlas-notify, atlas-notes**

Same pattern for each: move Express setup into `app.ts`, keep DB connection + listen in `index.ts`. For scheduler and notify, the event bus and worker initialization stays in `index.ts`.

- [ ] **Step 3: Verify services still start**

```bash
npm -w @atlas/server run typecheck
npm -w @atlas/dms run typecheck
npm -w @atlas/scheduler run typecheck
npm -w @atlas/notify run typecheck
npm -w @atlas/notes run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/*/src/app.ts apps/*/src/index.ts
git commit -m "refactor: extract Express app creation for testability"
```

---

### Task 5: Write shared package tests

**Files:**
- Create: `packages/event-bus/__tests__/match.test.ts`
- Create: `packages/server-common/__tests__/resolve-owner.test.ts`
- Create: `packages/server-common/__tests__/require-role.test.ts`

- [ ] **Step 1: Write matchPattern tests**

`packages/event-bus/__tests__/match.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { matchPattern } from '../src/match.js';

describe('matchPattern', () => {
  it('wildcard * matches everything', () => {
    expect(matchPattern('*', 'foo.bar.baz')).toBe(true);
  });

  it('exact match', () => {
    expect(matchPattern('foo.bar', 'foo.bar')).toBe(true);
    expect(matchPattern('foo.bar', 'foo.baz')).toBe(false);
  });

  it('trailing wildcard matches any suffix', () => {
    expect(matchPattern('foo.*', 'foo.bar')).toBe(true);
    expect(matchPattern('foo.*', 'foo.bar.baz')).toBe(true);
  });

  it('middle wildcard matches single segment', () => {
    expect(matchPattern('foo.*.baz', 'foo.bar.baz')).toBe(true);
    expect(matchPattern('foo.*.baz', 'foo.bar.qux')).toBe(false);
  });

  it('no match when event is shorter than pattern', () => {
    expect(matchPattern('foo.bar.baz', 'foo.bar')).toBe(false);
  });

  it('no match when event is longer than pattern (no wildcard)', () => {
    expect(matchPattern('foo.bar', 'foo.bar.baz')).toBe(false);
  });
});
```

- [ ] **Step 2: Write resolveOwner tests**

`packages/server-common/__tests__/resolve-owner.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { resolveOwner } from '../src/middleware/resolve-owner.js';

const mockReq = (sub: string, roles: string[] = [], queryUserId?: string) => ({
  auth: { sub, realm_access: { roles } },
  query: { userId: queryUserId },
}) as any;

describe('resolveOwner', () => {
  it('returns auth sub as ownerId for regular user', () => {
    const { ownerId, isAdmin } = resolveOwner(mockReq('user-1', ['user']));
    expect(ownerId).toBe('user-1');
    expect(isAdmin).toBe(false);
  });

  it('throws 403 if non-admin passes userId query', () => {
    expect(() => resolveOwner(mockReq('user-1', ['user'], 'other-user'))).toThrow();
  });

  it('allows admin to browse other user data', () => {
    const { ownerId, isAdmin } = resolveOwner(mockReq('admin-1', ['admin'], 'other-user'));
    expect(ownerId).toBe('other-user');
    expect(isAdmin).toBe(true);
  });

  it('admin without userId query returns own sub', () => {
    const { ownerId } = resolveOwner(mockReq('admin-1', ['admin']));
    expect(ownerId).toBe('admin-1');
  });
});
```

- [ ] **Step 3: Write requireRole tests**

`packages/server-common/__tests__/require-role.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { requireRole } from '../src/middleware/require-role.js';

const mockReq = (roles: string[]) => ({
  auth: { realm_access: { roles } },
}) as any;

describe('requireRole', () => {
  it('calls next() when user has required role', () => {
    const next = vi.fn();
    requireRole('admin')(mockReq(['admin', 'user']), {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with ApiError when user lacks role', () => {
    const next = vi.fn();
    requireRole('admin')(mockReq(['user']), {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('accepts any of multiple roles', () => {
    const next = vi.fn();
    requireRole('admin', 'editor')(mockReq(['editor']), {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm run test
```
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/*/
git commit -m "test: add unit tests for shared packages (matchPattern, resolveOwner, requireRole)"
```

---

### Task 6: Write smoke/API tests for backend services

**Files:**
- Create: `apps/atlas-core/__tests__/api/health.test.ts`
- Create: `apps/atlas-dms/__tests__/api/health.test.ts`
- Create: `apps/atlas-scheduler/__tests__/api/health.test.ts`
- Create: `apps/atlas-notify/__tests__/api/health.test.ts`
- Create: `apps/atlas-notes/__tests__/api/health.test.ts`

- [ ] **Step 1: Write core health test**

`apps/atlas-core/__tests__/api/health.test.ts`:
```typescript
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

// Mock DB and audit before importing app
vi.mock('../../src/config/db.js', () => ({ connectDB: vi.fn() }));
vi.mock('@atlas/server-common', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@atlas/server-common')>();
  return {
    ...mod,
    createAuditMiddleware: () => (_req: any, _res: any, next: any) => next(),
    createAuth: () => (_req: any, _res: any, next: any) => next(),
  };
});

import { createApp } from '../../src/app.js';

describe('GET /health', () => {
  const app = createApp();

  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });
});
```

- [ ] **Step 2: Create similar health tests for dms, scheduler, notify, notes**

Same pattern — mock DB and server-common, import `createApp`, test `GET /health` returns 200.

- [ ] **Step 3: Run all tests**

```bash
npm run test
```

- [ ] **Step 4: Commit**

```bash
git add apps/*/__tests__/
git commit -m "test: add smoke tests for all backend service health endpoints"
```

---

### Task 7: Write unit tests for key service logic

**Files:**
- Create: `apps/atlas-core/__tests__/services/userService.test.ts`
- Create: `apps/atlas-dms/__tests__/services/shareService.test.ts`
- Create: `apps/atlas-scheduler/__tests__/executors/shell.test.ts`

- [ ] **Step 1: Write userService tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/userDao.js', () => ({
  findByKeycloakId: vi.fn(),
  create: vi.fn(),
  updateById: vi.fn(),
}));

import * as userService from '../../src/services/userService.js';
import * as userDao from '../../src/daos/userDao.js';

describe('userService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('findOrCreateFromToken', () => {
    it('returns existing user if found', async () => {
      const existing = { id: '1', email: 'test@test.com' };
      vi.mocked(userDao.findByKeycloakId).mockResolvedValue(existing as any);
      const result = await userService.findOrCreateFromToken({ sub: 'kc-1', email: 'test@test.com' } as any);
      expect(result).toBe(existing);
      expect(userDao.create).not.toHaveBeenCalled();
    });

    it('creates new user if not found', async () => {
      vi.mocked(userDao.findByKeycloakId).mockResolvedValue(null as any);
      vi.mocked(userDao.create).mockResolvedValue({ id: '2' } as any);
      await userService.findOrCreateFromToken({ sub: 'kc-2', email: 'new@test.com', name: 'New' } as any);
      expect(userDao.create).toHaveBeenCalledWith({
        keycloakId: 'kc-2', email: 'new@test.com', name: 'New',
      });
    });
  });
});
```

- [ ] **Step 2: Write shareService revoke tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/shareTokenDao.js', () => ({
  findByToken: vi.fn(), findById: vi.fn(), deleteById: vi.fn(), create: vi.fn(), incrementDownloadCount: vi.fn(),
}));
vi.mock('../../src/daos/documentDao.js', () => ({ findById: vi.fn() }));
vi.mock('../../src/daos/folderDao.js', () => ({ findById: vi.fn() }));
vi.mock('../../src/services/storageService.js', () => ({ getPresignedDownloadUrl: vi.fn() }));

import { revoke } from '../../src/services/shareService.js';
import * as shareTokenDao from '../../src/daos/shareTokenDao.js';
import * as documentDao from '../../src/daos/documentDao.js';

describe('shareService.revoke', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws 404 when token not found by token or id', async () => {
    vi.mocked(shareTokenDao.findByToken).mockRejectedValue(new Error());
    vi.mocked(shareTokenDao.findById).mockResolvedValue(null as any);
    await expect(revoke('unknown', 'user-1')).rejects.toThrow('Share token not found');
  });

  it('throws 403 when non-owner tries to revoke', async () => {
    vi.mocked(shareTokenDao.findByToken).mockResolvedValue({
      id: 'share-1', type: 'document', documentId: 'doc-1',
    } as any);
    vi.mocked(documentDao.findById).mockResolvedValue({ ownerId: 'user-2' } as any);
    await expect(revoke('share-1', 'user-1')).rejects.toThrow('Access denied');
  });

  it('deletes token after ownership verified', async () => {
    vi.mocked(shareTokenDao.findByToken).mockResolvedValue({
      id: 'share-1', type: 'document', documentId: 'doc-1',
    } as any);
    vi.mocked(documentDao.findById).mockResolvedValue({ ownerId: 'user-1' } as any);
    vi.mocked(shareTokenDao.deleteById).mockResolvedValue(null as any);
    await revoke('share-1', 'user-1');
    expect(shareTokenDao.deleteById).toHaveBeenCalledWith('share-1');
  });
});
```

- [ ] **Step 3: Write shell executor tests**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { shellExecutor } from '../../src/executors/shell.js';

vi.mock('../../src/config/index.js', () => ({
  config: { allowShellExec: true },
}));

describe('shellExecutor', () => {
  it('rejects cwd outside allowed roots', async () => {
    const result = await shellExecutor.execute(
      { command: 'echo', args: ['hi'], cwd: '/etc/passwd' },
      5000
    );
    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('not allowed');
  });

  it('allows cwd inside /tmp', async () => {
    const result = await shellExecutor.execute(
      { command: 'echo', args: ['hello'] , cwd: '/tmp' },
      5000
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello');
  });

  it('returns error when shell exec is disabled', async () => {
    const { config } = await import('../../src/config/index.js');
    (config as any).allowShellExec = false;
    const result = await shellExecutor.execute({ command: 'echo', args: [] }, 5000);
    expect(result.error).toContain('disabled');
    (config as any).allowShellExec = true;
  });
});
```

- [ ] **Step 4: Run all tests**

```bash
npm run test
```

- [ ] **Step 5: Commit**

```bash
git add apps/*/__tests__/
git commit -m "test: add unit tests for userService, shareService, shellExecutor"
```

---

### Task 8: Create GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm run test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions CI workflow (typecheck + test)"
```

---

### Task 9: Create Docker build & push workflow

**Files:**
- Create: `.github/workflows/build.yml`

- [ ] **Step 1: Create build workflow**

`.github/workflows/build.yml`:
```yaml
name: Build & Push

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  build:
    needs: ci
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service:
          - name: atlas-core
            dockerfile: apps/atlas-core/Dockerfile
          - name: atlas-dms
            dockerfile: apps/atlas-dms/Dockerfile
          - name: atlas-scheduler
            dockerfile: apps/atlas-scheduler/Dockerfile
          - name: atlas-notify
            dockerfile: apps/atlas-notify/Dockerfile
          - name: atlas-notes
            dockerfile: apps/atlas-notes/Dockerfile
          - name: atlas-tracker
            dockerfile: apps/atlas-tracker/Dockerfile
          - name: atlas-mcp
            dockerfile: apps/atlas-mcp/Dockerfile
          - name: atlas-gui
            dockerfile: apps/atlas-gui/Dockerfile
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: xaverric/atlas-lab-${{ matrix.service.name }}
          tags: |
            type=sha,prefix=
            type=raw,value=latest,enable={{is_default_branch}}
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=semver,pattern={{major}}

      - uses: docker/build-push-action@v6
        with:
          context: .
          file: ${{ matrix.service.dockerfile }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/build.yml
git commit -m "ci: add Docker build & push workflow with matrix strategy"
```

---

### Task 10: Create nightly and release workflows

**Files:**
- Create: `.github/workflows/nightly.yml`
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create nightly workflow**

`.github/workflows/nightly.yml`:
```yaml
name: Nightly Build

on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  build:
    needs: ci
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service:
          - { name: atlas-core, dockerfile: apps/atlas-core/Dockerfile }
          - { name: atlas-dms, dockerfile: apps/atlas-dms/Dockerfile }
          - { name: atlas-scheduler, dockerfile: apps/atlas-scheduler/Dockerfile }
          - { name: atlas-notify, dockerfile: apps/atlas-notify/Dockerfile }
          - { name: atlas-notes, dockerfile: apps/atlas-notes/Dockerfile }
          - { name: atlas-tracker, dockerfile: apps/atlas-tracker/Dockerfile }
          - { name: atlas-mcp, dockerfile: apps/atlas-mcp/Dockerfile }
          - { name: atlas-gui, dockerfile: apps/atlas-gui/Dockerfile }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: ${{ matrix.service.dockerfile }}
          push: true
          tags: |
            xaverric/atlas-lab-${{ matrix.service.name }}:nightly
            xaverric/atlas-lab-${{ matrix.service.name }}:nightly-${{ github.run_id }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 2: Create release workflow**

`.github/workflows/release.yml`:
```yaml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true

      - name: Create release branch
        run: |
          VERSION=${GITHUB_REF#refs/tags/v}
          MAJOR_MINOR=$(echo $VERSION | cut -d. -f1,2)
          git checkout -b release/v${MAJOR_MINOR} || git checkout release/v${MAJOR_MINOR}
          git push origin release/v${MAJOR_MINOR} --force
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/nightly.yml .github/workflows/release.yml
git commit -m "ci: add nightly build and release workflows"
```

---

### Task 11: Update production docker-compose image references

**Files:**
- Modify: `deployment/docker-compose.yml`

- [ ] **Step 1: Update all image references**

Change all `ghcr.io/${GITHUB_REPO}/atlas-*:latest` to `xaverric/atlas-lab-*:latest`:

- `atlas-core` → `xaverric/atlas-lab-atlas-core:latest`
- `atlas-dms` → `xaverric/atlas-lab-atlas-dms:latest`
- `atlas-scheduler` → `xaverric/atlas-lab-atlas-scheduler:latest`
- `atlas-notify` → `xaverric/atlas-lab-atlas-notify:latest`
- `atlas-notes` → `xaverric/atlas-lab-atlas-notes:latest`
- `atlas-tracker` → `xaverric/atlas-lab-atlas-tracker:latest`
- `atlas-mcp` → `xaverric/atlas-lab-atlas-mcp:latest`
- `atlas-gui` → `xaverric/atlas-lab-atlas-gui:latest`

- [ ] **Step 2: Commit**

```bash
git add deployment/docker-compose.yml
git commit -m "feat(infra): switch Docker image references to Docker Hub"
```

---

### Task 12: Push to GitHub and verify CI

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

- [ ] **Step 2: Verify CI workflow runs on GitHub**

Check GitHub Actions tab — CI should trigger on push to main.

- [ ] **Step 3: Verify typecheck + tests pass in CI**

Monitor the workflow run. If it fails, fix and push again.
