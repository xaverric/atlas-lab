# Comprehensive Unit Test Suite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve 85% code coverage across all backend services and shared packages with zero failing tests.

**Architecture:** Each service/package gets independent test suites that mock DAOs, external clients, and infra (Redis, S3, Qdrant, Ollama). Tests run via Vitest workspace. Tasks 1-9 are fully independent and can be parallelized.

**Tech Stack:** Vitest, vi.mock(), vi.fn(), TypeScript, Node.js

**Spec:** `docs/superpowers/specs/2026-03-23-unit-tests-design.md`

---

## Conventions (apply to ALL tasks)

**Mocking pattern** (from existing tests):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// 1. vi.mock() BEFORE imports
vi.mock("../../src/daos/someDao.js", () => ({
  findById: vi.fn(),
  create: vi.fn(),
}));

// 2. Import after mock
import * as someService from "../../src/services/someService.js";
import * as someDao from "../../src/daos/someDao.js";

describe("someService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does something", async () => {
    vi.mocked(someDao.findById).mockResolvedValue({ id: "1" } as any);
    const result = await someService.getById("1");
    expect(result).toEqual({ id: "1" });
  });
});
```

**Middleware test pattern:**

```typescript
const mockReq = (overrides = {}) =>
  ({
    auth: { sub: "user-1", realm_access: { roles: ["user"] } },
    ...overrides,
  }) as any;
const mockRes = () => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
  return res;
};
const mockNext = vi.fn();
```

**Rules:**

- `.js` extensions in all imports (even for .ts files — matches existing pattern)
- `as any` for mock return values to avoid type gymnastics
- Test both happy path AND error paths (404, 403, validation)
- `expect(...).rejects.toThrow()` for async errors
- No real IO — everything mocked

---

## Task 0: Coverage config + workspace setup

**Files:**

- Modify: `vitest.config.ts`
- Modify: `vitest.workspace.ts`
- Modify: `apps/atlas-core/vitest.config.ts`
- Modify: `apps/atlas-dms/vitest.config.ts`
- Modify: `apps/atlas-scheduler/vitest.config.ts`
- Modify: `apps/atlas-notify/vitest.config.ts`
- Modify: `apps/atlas-notes/vitest.config.ts`
- Create: `apps/atlas-tracker/vitest.config.ts`
- Modify: `packages/server-common/vitest.config.ts`
- Modify: `packages/event-bus/vitest.config.ts`
- Create: `packages/core/vitest.config.ts`

- [ ] **Step 1: Update root vitest.config.ts thresholds to 85%**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      thresholds: {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85,
      },
    },
  },
});
```

- [ ] **Step 2: Add atlas-tracker and packages/core to vitest.workspace.ts**

```typescript
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "apps/atlas-core/vitest.config.ts",
  "apps/atlas-dms/vitest.config.ts",
  "apps/atlas-scheduler/vitest.config.ts",
  "apps/atlas-notify/vitest.config.ts",
  "apps/atlas-notes/vitest.config.ts",
  "apps/atlas-tracker/vitest.config.ts",
  "packages/core/vitest.config.ts",
  "packages/server-common/vitest.config.ts",
  "packages/event-bus/vitest.config.ts",
]);
```

- [ ] **Step 3: Update each workspace vitest config**

Each workspace config should follow this template (adjust `name`):

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "<workspace-name>",
    root: ".",
    include: ["__tests__/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/config/**",
        "src/models/**",
        "src/routes/**",
        "src/controllers/**",
        "src/daos/**",
      ],
    },
  },
});
```

For `packages/core`, exclude list is just `['src/index.ts']` (no daos/controllers/routes).
For `packages/event-bus`, exclude list is `['src/index.ts']`.
For `packages/server-common`, exclude list is `['src/index.ts', 'src/config/**']`.

Create `apps/atlas-tracker/vitest.config.ts` with name `atlas-tracker`.
Create `packages/core/vitest.config.ts` with name `core`.

- [ ] **Step 4: Run `npm run test` to verify existing tests still pass**

Run: `npm run test`
Expected: All 6 existing test files pass.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts vitest.workspace.ts apps/atlas-tracker/vitest.config.ts packages/core/vitest.config.ts apps/atlas-core/vitest.config.ts apps/atlas-dms/vitest.config.ts apps/atlas-scheduler/vitest.config.ts apps/atlas-notify/vitest.config.ts apps/atlas-notes/vitest.config.ts packages/server-common/vitest.config.ts packages/event-bus/vitest.config.ts
git commit -m "test: configure vitest coverage thresholds and add missing workspace entries"
```

---

## Task 1: packages/core — validators

**Files:**

- Create: `packages/core/__tests__/validators.test.ts`
- Source: `packages/core/src/validators/common.ts`

Read `packages/core/src/validators/common.ts` to understand the exact schema definitions.

- [ ] **Step 1: Write tests**

Create `packages/core/__tests__/validators.test.ts` testing:

**paginationSchema:**

- Defaults: empty object parses to defaults (page=1, limit=20 or whatever defaults are)
- Custom values: `{ page: 3, limit: 50 }` passes
- Negative page -> Zod error
- Limit exceeds max -> Zod error
- Non-numeric strings -> Zod error (or coercion, check schema)

**objectIdSchema:**

- Valid 24-char hex string passes
- Invalid length -> Zod error
- Non-hex characters -> Zod error
- Empty string -> Zod error

- [ ] **Step 2: Run tests**

Run: `npm run test -- --project core`
Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add packages/core/__tests__/
git commit -m "test(core): add validator tests for paginationSchema and objectIdSchema"
```

---

## Task 2: packages/server-common — middleware and utilities

**Files:**

- Create: `packages/server-common/__tests__/validate.test.ts`
- Create: `packages/server-common/__tests__/error-handler.test.ts`
- Create: `packages/server-common/__tests__/audit.test.ts`
- Create: `packages/server-common/__tests__/rate-limit.test.ts`
- Create: `packages/server-common/__tests__/sanitize.test.ts`
- Create: `packages/server-common/__tests__/publish-notification.test.ts`
- Source: `packages/server-common/src/middleware/validate.ts`, `error-handler.ts`, `audit.ts`, `rate-limit.ts`, `packages/server-common/src/sanitize.ts`, `packages/server-common/src/services/publish-notification.ts`

Read each source file before writing its tests.

- [ ] **Step 1: Write validate.test.ts**

Mock: nothing needed (Zod is pure).
Test the `validate` middleware factory with a Zod schema. Create mock req/res/next, test:

- Valid body -> calls `next()` with no args
- Invalid body -> calls `next()` with ApiError (status 400)
- Query params validation (if supported)
- Params validation (if supported)

- [ ] **Step 2: Write error-handler.test.ts**

Test the `errorHandler` middleware:

- ApiError instance -> `res.status(err.status).json({ error: err.message, details })`
- Generic Error -> `res.status(500).json({ error: 'Internal server error' })`
- ZodError -> extracts field errors, returns 400
- Non-Error object thrown -> 500

- [ ] **Step 3: Write audit.test.ts**

Mock: `mongoose` (audit model and connection). Read `audit.ts` carefully — it hooks `res.end()`.
Test `createAuditMiddleware`:

- Skips `/health` endpoint
- Skips OPTIONS requests
- Derives action from method+path (e.g., `POST /api/v1/users` -> `post.users`)
- Captures response status code via hooked `res.end()`

- [ ] **Step 4: Write rate-limit.test.ts**

Test:

- `createRateLimiter` returns a function (middleware)
- `apiRateLimiter` is exported and is a function
- `writeRateLimiter` is exported and is a function

- [ ] **Step 5: Write sanitize.test.ts**

Test `stripHtml`:

- `<p>text</p>` -> `text`
- Nested: `<div><p>text</p></div>` -> `text`
- Script tags: `<script>alert(1)</script>text` -> `text`
- Empty string -> empty string
- Event handlers: `<img onerror="alert(1)">` -> stripped

Test `sanitizeString`:

- Trims whitespace: `'  hello  '` -> `'hello'`
- Strips HTML: `'<b>hello</b>'` -> `'hello'`

- [ ] **Step 6: Write publish-notification.test.ts**

Read `packages/server-common/src/services/publish-notification.ts` to understand the factory.
Mock the event bus or HTTP client it uses.
Test:

- Factory returns a function
- Calling it publishes event with correct shape
- Errors are caught and swallowed (fire-and-forget)

- [ ] **Step 7: Run all server-common tests**

Run: `npm run test -- --project server-common`
Expected: All pass (including existing require-role and resolve-owner tests).

- [ ] **Step 8: Commit**

```bash
git add packages/server-common/__tests__/
git commit -m "test(server-common): add tests for validate, errorHandler, audit, rate-limit, sanitize, publishNotification"
```

---

## Task 3: packages/event-bus — bus with mocked Redis

**Files:**

- Create: `packages/event-bus/__tests__/bus.test.ts`
- Source: `packages/event-bus/src/bus.ts`

Read `packages/event-bus/src/bus.ts` carefully — it creates Redis clients on factory call.

- [ ] **Step 1: Write bus.test.ts**

Mock `ioredis`:

```typescript
const mockRedis = {
  connect: vi.fn(),
  subscribe: vi.fn(),
  on: vi.fn(),
  publish: vi.fn(),
  quit: vi.fn(),
  status: "ready",
};
vi.mock("ioredis", () => ({ default: vi.fn(() => ({ ...mockRedis })) }));
```

Test:

- `createEventBus` returns object with `publish`, `subscribe`, `close`, `isConnected`
- `publish` serializes envelope as JSON with `{ event, payload, timestamp, correlationId }`
- `publish` calls Redis publish on the channel
- `subscribe` registers handler, simulated message triggers handler for matching pattern
- `subscribe` with non-matching pattern -> handler not called
- `close` calls quit on both Redis clients
- Error in handler is caught (does not crash)

To simulate message delivery, capture the `on('message', ...)` callback from the mock and call it directly.

- [ ] **Step 2: Run tests**

Run: `npm run test -- --project event-bus`
Expected: All pass (including existing match.test.ts).

- [ ] **Step 3: Commit**

```bash
git add packages/event-bus/__tests__/
git commit -m "test(event-bus): add bus tests with mocked Redis"
```

---

## Task 4: apps/atlas-core — services

**Files:**

- Modify: `apps/atlas-core/__tests__/services/userService.test.ts` (expand)
- Create: `apps/atlas-core/__tests__/services/auditService.test.ts`
- Source: `apps/atlas-core/src/services/userService.ts`, `auditService.ts`

- [ ] **Step 1: Expand userService.test.ts**

Add tests for `updatePreferences`:

- Valid update -> calls `userDao.updateById` with preferences, returns updated user
- User not found -> throws 404 ApiError

Read `userService.ts` to check exact method signatures and what `updatePreferences` does.

- [ ] **Step 2: Write auditService.test.ts**

Mock: `auditDao` (or whatever DAO/model audit service uses).
Read `apps/atlas-core/src/services/auditService.ts` first.
Test `queryEvents`:

- Returns paginated results
- Passes filter params (action, dateRange, userId) to DAO
- Empty results -> returns empty data array with pagination metadata

- [ ] **Step 3: Run tests**

Run: `npm run test -- --project atlas-core`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add apps/atlas-core/__tests__/
git commit -m "test(core): expand userService tests, add auditService tests"
```

---

## Task 5: apps/atlas-dms — document, folder, share, storage services + middleware

**Files:**

- Create: `apps/atlas-dms/__tests__/services/documentService.test.ts`
- Create: `apps/atlas-dms/__tests__/services/folderService.test.ts`
- Modify: `apps/atlas-dms/__tests__/services/shareService.test.ts` (expand)
- Create: `apps/atlas-dms/__tests__/services/storageService.test.ts`
- Create: `apps/atlas-dms/__tests__/middleware/checkPublicPermission.test.ts`
- Source: all corresponding files in `apps/atlas-dms/src/`

Read each source file before writing tests.

- [ ] **Step 1: Write documentService.test.ts**

Mock: `documentDao`, `storageService`, `folderDao`.
Test all methods: `upload`, `list`, `getById` (found/404/403), `getDownloadUrl`, `getPreviewUrl`, `update` (found/404/403), `remove` (found/404/403 + storage delete), `bulkDelete`, `bulkMove`, `getTags`, public endpoints.

- [ ] **Step 2: Write folderService.test.ts**

Mock: `folderDao`, `documentDao`.
Test: CRUD, ownership checks on mutations, nested hierarchy.

- [ ] **Step 3: Expand shareService.test.ts**

Add tests for `create` (token generation, password hashing, ownership validation), `resolve` (valid/expired/max downloads), `verifyPassword` (correct/wrong/no password).

Mock: `bcrypt` for password tests, `crypto` for token generation.

- [ ] **Step 4: Write storageService.test.ts**

Mock: S3 client from `apps/atlas-dms/src/config/s3.ts`.
Read `storageService.ts` to see how the S3 client is used.
Test: `upload` (putObject params), `getPresignedDownloadUrl`, `getPresignedInlineUrl`, `remove` (deleteObject).

- [ ] **Step 5: Write checkPublicPermission.test.ts**

Mock: `folderDao`.
Test middleware: public folder with read permission -> next(), private -> 403, no folder -> appropriate behavior.

- [ ] **Step 6: Run tests**

Run: `npm run test -- --project atlas-dms`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add apps/atlas-dms/__tests__/
git commit -m "test(dms): add comprehensive tests for document, folder, share, storage services and middleware"
```

---

## Task 6: apps/atlas-scheduler — job/run services + all executors

**Files:**

- Create: `apps/atlas-scheduler/__tests__/services/jobService.test.ts`
- Create: `apps/atlas-scheduler/__tests__/services/runService.test.ts`
- Modify: `apps/atlas-scheduler/__tests__/executors/shell.test.ts` (expand)
- Create: `apps/atlas-scheduler/__tests__/executors/javascript.test.ts`
- Create: `apps/atlas-scheduler/__tests__/executors/webhook.test.ts`
- Create: `apps/atlas-scheduler/__tests__/executors/git.test.ts`
- Create: `apps/atlas-scheduler/__tests__/executors/n8n.test.ts`
- Create: `apps/atlas-scheduler/__tests__/executors/registry.test.ts`
- Source: all corresponding files in `apps/atlas-scheduler/src/`

- [ ] **Step 1: Write jobService.test.ts**

Mock: `jobDao`, `jobRunDao`, BullMQ queue.

```typescript
vi.mock("bullmq", () => ({
  Queue: vi.fn(() => ({ add: vi.fn(), remove: vi.fn(), close: vi.fn() })),
}));
```

Read `jobService.ts` — test:

- `create`: cron schedule computes `nextRunAt` (mock `cron-parser`), once schedule sets date
- `list`: passes filters to DAO, returns paginated
- `getById`: found/404/403
- `update`: reschedules if schedule changed
- `remove`: deletes job + runs
- `setEnabled`: toggle scheduling
- `addNotification` / `removeNotification`

- [ ] **Step 2: Write runService.test.ts**

Mock: `jobRunDao`, `jobDao`.
Test: create run, list runs for job, manual trigger.

- [ ] **Step 3: Expand shell.test.ts**

Add: env filtering (sensitive vars like `DATABASE_URL` stripped), output truncation at 50KB, timeout handling, non-zero exit code -> failed result, `allowShellExec=false` -> error.

- [ ] **Step 4: Write javascript.test.ts**

Mock: `child_process` module (however Docker is invoked).
Read `apps/atlas-scheduler/src/executors/javascript.ts` first.
Test: Docker command flags (network=none, memory=128m, cpus=0.5, readonly, NO_NEW_PRIVILEGES), code wrapping, success/error/timeout results.

- [ ] **Step 5: Write webhook.test.ts**

Mock: `fetch` or HTTP client used.
Read `apps/atlas-scheduler/src/executors/webhook.ts` first.
Test: successful POST, custom headers, non-2xx -> failed, timeout -> error.

- [ ] **Step 6: Write git.test.ts**

Mock: `child_process` module.
Read `apps/atlas-scheduler/src/executors/git.ts` first.
Test: clone command construction, pull command, auth handling, errors.

- [ ] **Step 7: Write n8n.test.ts**

Mock: `fetch` or HTTP client.
Read `apps/atlas-scheduler/src/executors/n8n.ts` first.
Test: workflow trigger, response parsing, error handling.

- [ ] **Step 8: Write registry.test.ts**

Read `apps/atlas-scheduler/src/executors/index.ts`.
Test: get known executor types, unknown type -> error/undefined.

- [ ] **Step 9: Run tests**

Run: `npm run test -- --project atlas-scheduler`
Expected: All pass.

- [ ] **Step 10: Commit**

```bash
git add apps/atlas-scheduler/__tests__/
git commit -m "test(scheduler): add comprehensive tests for job/run services and all executors"
```

---

## Task 7: apps/atlas-notify — notification services + channels

**Files:**

- Create: `apps/atlas-notify/__tests__/services/notifyService.test.ts`
- Create: `apps/atlas-notify/__tests__/services/templateResolver.test.ts`
- Create: `apps/atlas-notify/__tests__/services/eventProcessor.test.ts`
- Create: `apps/atlas-notify/__tests__/services/sseManager.test.ts`
- Create: `apps/atlas-notify/__tests__/services/channelService.test.ts`
- Create: `apps/atlas-notify/__tests__/services/preferenceService.test.ts`
- Create: `apps/atlas-notify/__tests__/channels/registry.test.ts`
- Create: `apps/atlas-notify/__tests__/channels/inapp.test.ts`
- Create: `apps/atlas-notify/__tests__/channels/email.test.ts`
- Create: `apps/atlas-notify/__tests__/channels/telegram.test.ts`
- Create: `apps/atlas-notify/__tests__/channels/webpush.test.ts`
- Create: `apps/atlas-notify/__tests__/channels/sms.test.ts`
- Source: all corresponding files in `apps/atlas-notify/src/`

Read each source file before writing tests. This service has module-level BullMQ side effects.

- [ ] **Step 1: Write notifyService.test.ts**

Mock: `notificationDao`, `channelDao`, `templateResolver`, `sseManager`, BullMQ Queue.

```typescript
vi.mock("bullmq", () => ({
  Queue: vi.fn(() => ({ add: vi.fn(), close: vi.fn() })),
}));
vi.mock("../../src/services/sseManager.js", () => ({ pushToUser: vi.fn() }));
```

Test `send`:

- Resolves template, fetches channels (enabled+verified), creates deliveries, queues BullMQ jobs for external channels
- No channels -> fallback in-app only
- Pushes SSE event after creation

Test `createDirect`, `history`, `markRead`, `markAllRead`, `unreadCount`, `ensureUserSetup`.

- [ ] **Step 2: Write templateResolver.test.ts**

Mock: `templateDao`.
Test:

- Resolve with templateKey -> looks up by key
- Resolve with event -> looks up by event
- No template -> humanized fallback (e.g., `scheduler.job.completed` -> `Scheduler Job Completed`)
- `interpolate`: `{{name}}` replaced, missing var -> empty, multiple occurrences

- [ ] **Step 3: Write eventProcessor.test.ts**

Mock: event bus, `notificationDao`, `channelDao`, `preferenceDao`, `sseManager`, BullMQ.
Test:

- On event: extracts userId, finds matching rules, maps channels to deliveries
- No matching rules -> no notification
- Queues BullMQ jobs for external channels

- [ ] **Step 4: Write sseManager.test.ts**

No mocks needed — this is pure in-memory state management.
Test:

- `addClient` / `removeClient`: manage Map of userId to Set of Response
- `pushToUser`: writes SSE format to all connections, no connections -> no-op
- `getConnectedCount`: returns total

Use mock Response objects with `write` and `on` methods.

- [ ] **Step 5: Write channelService.test.ts**

Mock: `channelDao`.
Test: CRUD, `findVerified` (only verified+enabled), `findByUser`.

- [ ] **Step 6: Write preferenceService.test.ts**

Mock: `preferenceDao`.
Test: CRUD, `findMatchingRules` (exact match, wildcard, no match, multiple).

- [ ] **Step 7: Write channel tests (registry, inapp, email, telegram, webpush, sms)**

**registry.test.ts:** Test `registerChannel`, `getDeliverer` by type, unknown -> error.

**inapp.test.ts:** Mock notification DAO. Test: creates notification, returns success result.

**email.test.ts:** Mock `nodemailer` transport. Test: sends with subject/body, SMTP error -> failed result.

**telegram.test.ts:** Mock `fetch`. Test: sends API call, API error -> failed result.

**webpush.test.ts:** Mock `web-push`. Test: sends notification, 410 -> subscription expired handling.

**sms.test.ts:** Mock `twilio`. Test: sends message, error -> failed result.

**signal.test.ts:** Mock `fetch` (Signal CLI HTTP API). Test: sends POST to CLI endpoint, formats message with sender/recipients, API error -> failed result.

**whatsapp.test.ts:** Mock `twilio`. Test: sends with `whatsapp:` prefix on from/to, error -> failed result.

- [ ] **Step 8: Run tests**

Run: `npm run test -- --project atlas-notify`
Expected: All pass.

- [ ] **Step 9: Commit**

```bash
git add apps/atlas-notify/__tests__/
git commit -m "test(notify): add comprehensive tests for notification services, channels, and event processing"
```

---

## Task 8: apps/atlas-notes — note services + embedding/vector + middleware

**Files:**

- Create: `apps/atlas-notes/__tests__/services/noteService.test.ts`
- Create: `apps/atlas-notes/__tests__/services/noteFolderService.test.ts`
- Create: `apps/atlas-notes/__tests__/services/revisionService.test.ts`
- Create: `apps/atlas-notes/__tests__/services/embeddingService.test.ts`
- Create: `apps/atlas-notes/__tests__/services/vectorService.test.ts`
- Create: `apps/atlas-notes/__tests__/services/searchService.test.ts`
- Create: `apps/atlas-notes/__tests__/middleware/optionalAuth.test.ts`
- Create: `apps/atlas-notes/__tests__/middleware/checkPublicPermission.test.ts`
- Source: all corresponding files in `apps/atlas-notes/src/`

Read each source file before writing tests.

- [ ] **Step 1: Write noteService.test.ts**

Mock: `noteDao`, `noteFolderDao`, `embeddingService`, `vectorService`, `revisionService`.
Test:

- `create`: creates note, fires embedding in background, sets contentSize
- `list`: filters (tags, search, sort), pagination
- `getById`: found/404/403
- `update`: updates fields, creates revision, re-embeds
- `remove`: deletes note + vector
- `getTags`: distinct tags
- Public access: isPublic check, folder permission
- `addAttachment` / `removeAttachment`
- `getByIdPublic`: public -> return, private -> 403

- [ ] **Step 2: Write noteFolderService.test.ts**

Mock: `noteFolderDao`, `noteDao`.
Test: CRUD, ownership, public permission, hierarchy.

- [ ] **Step 3: Write revisionService.test.ts**

Mock: `revisionDao`.
Read `revisionService.ts` carefully for `generateSummary` and `restore` logic.
Test:

- `createRevision`: saves diff
- `generateSummary`: detects title/content/tags changes, no changes -> null
- `listRevisions`: paginated
- `getRevision`: found/404
- `restore`: pre-snapshot, restore, post-revision

- [ ] **Step 4: Write embeddingService.test.ts**

Mock: global `fetch` for Ollama API.
Test:

- `prepareText`: combines title + tags + content, empty tags handled
- `generateEmbedding`: calls `POST /api/embed`, returns vector, API error -> throws

- [ ] **Step 5: Write vectorService.test.ts**

Mock: Qdrant client (however it is imported — read source).
Test:

- `upsertNote`: correct point format (ID conversion to UUID, payload, vector)
- `deleteNote`: calls delete
- `search`: returns scored results, empty -> empty, error handling

- [ ] **Step 6: Write searchService.test.ts**

Mock: `noteDao`, `embeddingService`, `vectorService`.
Test:

- Full-text: delegates to DAO
- Semantic: embed query -> Qdrant search -> fetch notes by IDs
- Combined: merges + deduplicates
- Empty query -> empty

- [ ] **Step 7: Write middleware tests**

**optionalAuth.test.ts:** Mock auth verification.

- Valid token -> attaches auth, calls next
- No token -> calls next without auth
- Invalid token -> calls next without auth

**checkPublicPermission.test.ts:** Mock `noteFolderDao`.

- Public note -> next, private -> 403, folder permission check

- [ ] **Step 8: Run tests**

Run: `npm run test -- --project atlas-notes`
Expected: All pass.

- [ ] **Step 9: Commit**

```bash
git add apps/atlas-notes/__tests__/
git commit -m "test(notes): add comprehensive tests for note services, embedding, vector search, and middleware"
```

---

## Task 9: apps/atlas-tracker — endpoint, data, schema services

**Files:**

- Create: `apps/atlas-tracker/__tests__/services/endpointService.test.ts`
- Create: `apps/atlas-tracker/__tests__/services/dataService.test.ts`
- Create: `apps/atlas-tracker/__tests__/services/schemaValidator.test.ts`
- Source: `apps/atlas-tracker/src/services/endpointService.ts`, `dataService.ts`, `schemaValidator.ts`

Read each source file before writing tests.

- [ ] **Step 1: Write endpointService.test.ts**

Mock: `endpointDao`, `schemaValidator`, `mongoose.connection` (for dynamic collection ops).
Test:

- `create`: validates slug format, checks duplicates, creates collection + compiles schema
- `list`: returns user endpoints
- `getByName` / `getPublicByName`: found/404
- `update`: updates endpoint, recompiles schema if changed
- `remove`: drops collection, removes validator, deletes endpoint

- [ ] **Step 2: Write dataService.test.ts**

Mock: `dynamicDao` (or however dynamic collections are accessed), `schemaValidator`, `publishNotification`.
Test:

- `insert`: validates against schema, inserts, publishes notification
- `insert`: validation failure -> error with details
- `query`: builds filter from params (from/to dates, sort, limit, offset), returns paginated
- `query`: sanitization (string to number conversion)
- `deleteEntry`: removes by ID

- [ ] **Step 3: Write schemaValidator.test.ts**

This uses AJV — may not need heavy mocking since AJV is a pure library.
Test:

- `compile`: compiles valid JSON schema, returns validator
- `compile`: schema too deep (>10 levels) -> error
- `validate`: valid data -> `{ valid: true }`
- `validate`: invalid data -> `{ valid: false, errors: [...] }`
- `validate`: missing required fields -> errors
- `remove`: clears compiled validator

- [ ] **Step 4: Run tests**

Run: `npm run test -- --project atlas-tracker`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add apps/atlas-tracker/__tests__/
git commit -m "test(tracker): add tests for endpoint, data, and schema validator services"
```

---

## Task 10: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests pass, zero failures.

- [ ] **Step 2: Run coverage report**

Run: `npm run test:coverage`
Review output. Each workspace should be at or above 85% for lines, branches, functions, statements.

- [ ] **Step 3: Fix any coverage gaps**

If any workspace is below 85%, identify uncovered lines/branches and add targeted tests. Common gaps:

- Uncovered branches in error handling paths
- Untested utility functions
- Edge cases in conditional logic

- [ ] **Step 4: Final commit if needed**

```bash
git add -A
git commit -m "test: achieve 85% coverage across all services"
```
