# Tests & CI/CD Pipeline Design

## Goal

Fix pre-existing TypeScript errors, add test coverage (unit + smoke), and set up CI/CD with GitHub Actions for automated builds, testing, image publishing to Docker Hub, and release management.

## Scope

### In scope
- Fix 20 pre-existing TypeScript errors across 6 files
- Vitest setup with monorepo workspace support
- Unit tests for service layer + shared packages
- Smoke/API tests for each backend service
- GitHub Actions: CI (typecheck + test), build + push images, nightly, release
- Docker Hub image publishing (`xaverric/atlas-lab-*`)
- Release branch strategy (trunk + release branches + feature branch support)
- Update prod docker-compose to reference Docker Hub images

### Out of scope (later)
- Automated deploy to server (SSH/webhook)
- Backup strategy
- Monitoring/alerting
- E2E browser tests

---

## Part 1: TypeScript Error Fixes

### systemController.ts (10 errors)

| Error | Fix |
|-------|-----|
| `.client` not on Connection (5x) | Cast: `(mongoose.connection as any).client.db(...)` — Mongoose 8 exposes `.client` at runtime but types lag |
| `sizeOnDisk` possibly undefined (2x) | Default: `db.sizeOnDisk ?? 0` |
| Implicit `any` in .map callbacks (2x) | Add type annotations: `.map((d: any) => ...)` |
| `string[]` as index type (1x) | Add type guard: `if (section in SECTION_DB_MAP)` |

### GUI errors (10 errors)

| File | Error | Fix |
|------|-------|-----|
| `audit/page.tsx` (3x) | `unknown` not assignable to ReactNode | Cast: `String(event.error)` or `JSON.stringify(...)` with explicit string conversion |
| `preferences/page.tsx` (2x) | `.disabled` not on union type | Add `disabled?: boolean` to channel type definition |
| `scheduler/jobs/[id]/page.tsx` (3x) | Missing `hasItem/addItem/removeItem` | Add convenience methods to dashboard-store or migrate call sites to `getWidgets/addWidget/removeWidget` |
| `tiptap-editor.tsx` (1x) | `false` not assignable to SetContentOptions | Change `setContent(content, false)` to `setContent(content, { emitUpdate: false })` |
| `auth.ts` (1x) | `Record<string, unknown>` not assignable to IdTokenClaims | Cast: `parseJwtPayload(token) as IdTokenClaims` |

---

## Part 2: Test Infrastructure

### Framework: Vitest

**Root config:** `vitest.workspace.ts` defining all testable workspaces.

**Per-workspace config:** Each service/package gets minimal `vitest.config.ts` extending shared settings.

### Test structure

```
apps/atlas-core/
  __tests__/
    services/
      userService.test.ts
      auditService.test.ts
    api/
      health.test.ts
      user.test.ts

apps/atlas-dms/
  __tests__/
    services/
      documentService.test.ts
      folderService.test.ts
      shareService.test.ts
    api/
      health.test.ts

apps/atlas-scheduler/
  __tests__/
    services/
      jobService.test.ts
    executors/
      javascript.test.ts
      shell.test.ts
    api/
      health.test.ts

apps/atlas-notify/
  __tests__/
    services/
      notifyService.test.ts
      templateService.test.ts
    api/
      health.test.ts

apps/atlas-notes/
  __tests__/
    services/
      noteService.test.ts
      noteFolderService.test.ts
    api/
      health.test.ts

packages/server-common/
  __tests__/
    middleware/
      resolve-owner.test.ts
      require-role.test.ts
    config/
      db.test.ts

packages/event-bus/
  __tests__/
    match.test.ts
```

### Unit test approach

- Mock DAO layer with `vi.mock()` — no real DB
- Test service functions: happy path, error cases, edge cases
- Focus on business logic: validation, authorization, error throwing

Example:
```typescript
// apps/atlas-dms/__tests__/services/shareService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/shareTokenDao.js', () => ({
  findByToken: vi.fn(),
  findById: vi.fn(),
  deleteById: vi.fn(),
}));

describe('shareService.revoke', () => {
  it('throws 404 if token not found', async () => { ... });
  it('throws 403 if not owner', async () => { ... });
  it('deletes token after ownership verified', async () => { ... });
});
```

### Smoke/API test approach

- Use `supertest` on Express app instance
- Mock DB connection (don't connect to real MongoDB)
- Test: status codes, response shape, auth guard, error format

Example:
```typescript
// apps/atlas-core/__tests__/api/health.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js'; // need to extract app creation

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });
});
```

**Note:** Each service's `index.ts` currently creates the app and starts listening in one shot. For testability, we need to extract the Express app creation into a separate `app.ts` that exports the app without calling `.listen()`. The `index.ts` then imports from `app.ts` and starts the server.

### Scripts

```json
// root package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Part 3: CI/CD — GitHub Actions

### Workflow: `ci.yml`

**Triggers:** push to `main`, PR to `main`, push to `feature/*`

**Steps:**
1. Checkout + Node 22 setup + npm ci
2. Typecheck (`npm run typecheck`)
3. Lint (`npm run lint`)
4. Test (`npm run test`)

### Workflow: `build-and-push.yml`

**Triggers:** push to `main` (after CI passes), tag `v*`

**Steps:**
1. Checkout + Docker Buildx setup
2. Login to Docker Hub (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` secrets)
3. Build + push all service images in parallel (matrix strategy)
4. Tag strategy:
   - `main` push: `latest`, `sha-<short>`
   - Tag `v1.2.3`: `1.2.3`, `1.2`, `1`

**Matrix:**
```yaml
strategy:
  matrix:
    service:
      - { name: atlas-core, context: ., dockerfile: apps/atlas-core/Dockerfile }
      - { name: atlas-dms, context: ., dockerfile: apps/atlas-dms/Dockerfile }
      - { name: atlas-scheduler, context: ., dockerfile: apps/atlas-scheduler/Dockerfile }
      - { name: atlas-notify, context: ., dockerfile: apps/atlas-notify/Dockerfile }
      - { name: atlas-notes, context: ., dockerfile: apps/atlas-notes/Dockerfile }
      - { name: atlas-tracker, context: ., dockerfile: apps/atlas-tracker/Dockerfile }
      - { name: atlas-mcp, context: ., dockerfile: apps/atlas-mcp/Dockerfile }
      - { name: atlas-gui, context: ., dockerfile: apps/atlas-gui/Dockerfile }
```

Image names: `xaverric/atlas-lab-<name>:<tag>`

### Workflow: `nightly.yml`

**Trigger:** cron `0 2 * * *` (2:00 UTC daily)

**Steps:** Same as build-and-push but tags: `nightly`, `nightly-YYYY-MM-DD`

### Workflow: `release.yml`

**Trigger:** tag `v*` pushed

**Steps:**
1. Run CI (typecheck + test)
2. Build + push images with version tags
3. Create GitHub Release with auto-generated notes
4. Create/update release branch `release/v<major>.<minor>`

### Secrets needed

| Secret | Purpose |
|--------|---------|
| `DOCKERHUB_USERNAME` | Docker Hub login |
| `DOCKERHUB_TOKEN` | Docker Hub access token |

### Production docker-compose update

Change all image references from `ghcr.io/${GITHUB_REPO}/atlas-*:latest` to `xaverric/atlas-lab-*:latest`.

---

## Part 4: App refactoring for testability

Each backend service needs a minor refactor to separate app creation from server startup:

**Before:**
```typescript
// index.ts
const app = express();
app.use(...);
app.listen(port);
```

**After:**
```typescript
// app.ts
export const createApp = () => {
  const app = express();
  app.use(...);
  return app;
};

// index.ts
import { createApp } from './app.js';
const app = createApp();
app.listen(port);
```

This lets tests import `createApp()` without starting a server.

---

## Implementation order

1. Fix 20 TS errors
2. Refactor services for testability (extract `app.ts`)
3. Set up Vitest infrastructure
4. Write unit tests (service layer + shared packages)
5. Write smoke/API tests
6. Update docker-compose image references
7. Create GitHub Actions workflows
8. Test CI locally with `act` or push and verify
