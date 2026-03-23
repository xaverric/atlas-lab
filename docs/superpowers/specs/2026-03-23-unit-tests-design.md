# Unit Test Suite — Comprehensive Coverage

**Date:** 2026-03-23
**Status:** Draft

## Goal

Achieve **85% code coverage** across all backend services and shared packages with **zero failing tests**. Focus on services, middleware, utilities, and executors — the business logic layer.

## Out of Scope

- **atlas-mcp** — thin HTTP proxy, no business logic
- **DAOs** — Mongoose wrappers, mocked in service tests
- **Controllers** — pass-through to services, no logic
- **Frontend (atlas-gui)** — separate initiative
- **Integration tests** — no real DB/Redis/S3/Qdrant

## Hard Requirements

1. **85% code coverage** (lines, branches, functions, statements) per workspace
2. **Zero failing tests** — all green on `npm run test`
3. Follow existing patterns: `vi.mock()`, `mockResolvedValue`, `async/await`

## Coverage Configuration

Update root `vitest.config.ts` thresholds to 85%. Each workspace vitest config gets `coverage` block pointing at its `src/` with 85% thresholds. Exclude from coverage: `src/index.ts` (server startup), `src/config/`, `src/models/` (Mongoose schemas), `src/routes/` (route wiring), `src/controllers/` (pass-through).

## Test Suites

### packages/core (1 suite, ~10 tests)

**`__tests__/validators.test.ts`**
- `paginationSchema`: defaults (page=1, limit=20), custom values, negative page → error, limit > max → error, non-numeric → error
- `objectIdSchema`: valid 24-char hex, invalid length, non-hex chars, empty string

### packages/server-common (5 suites, ~40 tests)

**`__tests__/validate.test.ts`**
- Valid body passes through, invalid body → 400 with Zod details, valid query params, valid route params, empty body with required fields

**`__tests__/error-handler.test.ts`**
- ApiError → correct status + message, ApiError with details, unknown Error → 500, Zod validation error formatting, non-Error thrown object

**`__tests__/audit.test.ts`**
- `createAuditMiddleware` attaches `logAuditEvent` to req, `logAuditEvent` creates correct event shape, event includes user/action/resource/timestamp

**`__tests__/rate-limit.test.ts`**
- `createRateLimiter` returns middleware, respects windowMs/max config, `apiRateLimiter` and `writeRateLimiter` are configured correctly

**`__tests__/sanitize.test.ts`**
- `stripHtml` removes tags, preserves text content, handles nested tags, empty input → empty string
- `sanitizeString` trims whitespace, strips HTML, handles null/undefined gracefully
- XSS vectors: script tags, event handlers, data URIs

### packages/event-bus (1 suite, ~12 tests)

**`__tests__/bus.test.ts`**
- `createEventBus` returns EventBus interface (mock Redis)
- `subscribe` registers handler for pattern
- `publish` delivers to matching subscribers
- `publish` delivers to multiple matching patterns
- `publish` skips non-matching subscribers
- `unsubscribe` removes handler
- Error in handler doesn't crash bus
- Envelope shape: `{ event, data, timestamp }`

### apps/atlas-core (3 suites, ~25 tests)

**`__tests__/services/userService.test.ts`** (expand existing)
- `findOrCreateFromToken`: existing user found → return, new user → create with token data, create with default preferences
- `updatePreferences`: valid theme → update, invalid preferences → error, user not found → 404

**`__tests__/services/auditService.test.ts`**
- `queryEvents`: returns paginated results, filter by action, filter by date range, filter by userId, empty results → empty array, pagination defaults

**`__tests__/services/publishNotification.test.ts`**
- Publishes event with correct shape, swallows errors silently (fire-and-forget), includes userId and event type

### apps/atlas-dms (5 suites, ~55 tests)

**`__tests__/services/documentService.test.ts`**
- `upload`: creates document record + stores file, sets correct metadata (size, mimeType, storageKey)
- `list`: passes filters to DAO (tags, search, dateRange, sort), pagination (page, limit), returns PaginatedResponse shape
- `getById`: found → return, not found → 404, wrong owner → 403
- `getDownloadUrl`: generates presigned URL, not found → 404
- `getPreviewUrl`: generates inline presigned URL
- `update`: updates fields, not found → 404, wrong owner → 403
- `remove`: deletes record + storage, not found → 404, wrong owner → 403
- `bulkDelete`: deletes multiple, skips non-owned, removes storage for each
- `bulkMove`: moves to folder, validates folder ownership
- Public endpoints: `getPublicDocument`, `getPublicDownloadUrl`

**`__tests__/services/folderService.test.ts`**
- CRUD: create, get (404), list, update, delete
- Ownership checks on all mutations
- Delete folder with documents → error or cascade
- Nested folder hierarchy

**`__tests__/services/shareService.test.ts`** (expand existing)
- `create`: generates token, hashes password (bcrypt), validates ownership, sets expiry
- `resolve`: valid token → return share, expired → 404/error, max downloads reached → error, no token → 404
- `verifyPassword`: correct password → true, wrong → false, no password set → true
- `revoke`: owner can revoke, non-owner → 403, not found → 404

**`__tests__/services/storageService.test.ts`**
- `upload`: calls S3 putObject with correct params
- `getPresignedDownloadUrl`: returns signed URL with expiry
- `getPresignedInlineUrl`: returns signed URL with content-disposition inline
- `remove`: calls S3 deleteObject
- Error handling: S3 connection failure

**`__tests__/middleware/checkPublicPermission.test.ts`**
- Public folder with read permission → next()
- Public folder with wrong permission → 403
- Private folder → 403
- No folder → 404
- Document in public folder → allowed

### apps/atlas-scheduler (8 suites, ~65 tests)

**`__tests__/services/jobService.test.ts`**
- `create`: cron schedule → computes nextRunAt, once schedule → sets exact date, invalid cron → error
- `list`: filters by executionType, enabled, group, tags, search; pagination
- `getById`: found → return, not found → 404, wrong owner → 403
- `update`: reschedules on schedule change, partial update
- `remove`: deletes job + associated runs
- `setEnabled`: true → schedules, false → unschedules
- `addNotification` / `removeNotification`: adds/removes notification config

**`__tests__/services/runService.test.ts`**
- Create run record, list runs for job, manual trigger creates run with triggeredBy

**`__tests__/executors/shell.test.ts`** (expand existing)
- Valid cwd in allowed roots → executes
- cwd outside allowed roots → error
- Environment variable filtering (strips sensitive vars)
- Output truncation at 50KB
- Timeout handling
- Command with exit code ≠ 0 → failed result
- `ALLOW_SHELL_EXEC=false` → error

**`__tests__/executors/javascript.test.ts`**
- Docker command construction: image, network=none, memory, cpus, readonly, NO_NEW_PRIVILEGES
- Code wrapping with console/http mocks
- Successful execution → stdout captured
- Script error → failed result with stderr
- Timeout → killed + timeout result

**`__tests__/executors/webhook.test.ts`**
- Successful POST → result with status + body
- Custom headers forwarded
- Timeout → error result
- Non-2xx response → failed result
- Invalid URL → error

**`__tests__/executors/git.test.ts`**
- Clone command construction with URL
- Pull command for existing repo
- Auth token injection
- Error handling

**`__tests__/executors/n8n.test.ts`**
- Workflow trigger HTTP call
- Response parsing
- Error handling

**`__tests__/executors/registry.test.ts`**
- `getExecutor('shell')` → shellExecutor
- `getExecutor('webhook')` → webhookExecutor
- `getExecutor('unknown')` → error

### apps/atlas-notify (8 suites, ~60 tests)

**`__tests__/services/notifyService.test.ts`**
- `send`: resolves template, finds matching preferences, queues delivery for enabled+verified channels
- `send`: no matching preferences → uses default in-app
- `createDirect`: creates notification without template
- `history`: returns paginated results for user
- `markRead`: marks single notification
- `markAllRead`: marks all for user
- `unreadCount`: returns count
- `ensureUserSetup`: creates in-app channel + default preference rule if missing, skips if exists

**`__tests__/services/templateResolver.test.ts`**
- `resolve` by key: found → return populated template
- `resolve` by key: not found → fallback to event-based
- `resolve` by event: found → return
- `resolve`: no template → humanized event name as fallback
- `interpolate`: replaces `{{var}}` placeholders, missing var → empty string, nested vars, multiple occurrences

**`__tests__/services/channelService.test.ts`**
- CRUD: create, list, update, delete
- `findVerified`: only returns verified+enabled channels
- `findByUser`: returns all user channels

**`__tests__/services/preferenceService.test.ts`**
- CRUD: create, list, update, delete
- `findMatchingRules`: exact event match, wildcard `*` match, no match → empty array, multiple matching rules

**`__tests__/channels/registry.test.ts`**
- `registerChannel` adds deliverer
- `getDeliverer` returns correct type
- Unknown type → error

**`__tests__/channels/inapp.test.ts`**
- Creates notification record, returns success delivery result

**`__tests__/channels/email.test.ts`**
- Sends via SMTP transport (mocked), formats subject/body, connection error → failed delivery result

**`__tests__/channels/telegram.test.ts`**
- Sends via Telegram API (mocked HTTP), formats message, API error → failed delivery result

### apps/atlas-notes (7 suites, ~55 tests)

**`__tests__/services/noteService.test.ts`**
- `create`: creates note, fires embedding in background, sets contentSize
- `list`: filters (tags, search, sort), pagination
- `getById`: found → return, not found → 404, wrong owner → 403
- `update`: updates fields, creates revision, triggers re-embedding
- `remove`: deletes note + vector, not found → 404
- `getTags`: returns distinct tags for user
- Public access: isPublic flag check, public folder permission check
- `addAttachment` / `removeAttachment`: modifies attachment array

**`__tests__/services/noteFolderService.test.ts`**
- CRUD: create, get, list, update, delete
- Ownership checks
- Public permission propagation
- Nested hierarchy

**`__tests__/services/revisionService.test.ts`**
- `createRevision`: captures old → new diff
- `generateSummary`: title changed, content changed, tags changed, multiple changes, no changes → no revision

**`__tests__/services/embeddingService.test.ts`**
- `prepareText`: combines title + tags + content, handles empty tags, strips HTML from content
- `generateEmbedding`: calls Ollama API, returns 768-dim vector, API error → throws, empty text → skips

**`__tests__/services/vectorService.test.ts`**
- `upsertNote`: calls Qdrant upsert with correct point (ID conversion, payload, vector)
- `deleteNote`: calls Qdrant delete
- `search`: returns scored results, empty results → empty array, handles Qdrant errors

**`__tests__/services/searchService.test.ts`**
- Full-text search: delegates to DAO, returns results
- Semantic search: generates embedding → Qdrant search → fetch notes
- Combined search: merges + deduplicates results
- Empty query → empty results

**`__tests__/middleware/optionalAuth.test.ts`**
- Valid token → attaches auth to req, calls next
- No token → calls next without auth (no error)
- Invalid token → calls next without auth

## Total

| Area | Suites | Est. Tests |
|------|--------|------------|
| packages/core | 1 | 10 |
| packages/server-common | 5 | 40 |
| packages/event-bus | 1 | 12 |
| atlas-core | 3 | 25 |
| atlas-dms | 5 | 55 |
| atlas-scheduler | 8 | 65 |
| atlas-notify | 8 | 60 |
| atlas-notes | 7 | 55 |
| **Total** | **38** | **~322** |

## Coverage Config Changes

1. Root `vitest.config.ts`: bump thresholds to 85%
2. Each workspace `vitest.config.ts`: add coverage block:
   ```ts
   coverage: {
     provider: 'v8',
     include: ['src/**/*.ts'],
     exclude: ['src/index.ts', 'src/config/**', 'src/models/**', 'src/routes/**', 'src/controllers/**', 'src/daos/**'],
     thresholds: { branches: 85, functions: 85, lines: 85, statements: 85 },
   }
   ```

## Implementation Order

1. `packages/core` + `packages/server-common` + `packages/event-bus` (foundations)
2. `atlas-core` (simplest service)
3. `atlas-dms` (complex, many edge cases)
4. `atlas-scheduler` (executors are isolated, good parallelization)
5. `atlas-notify` (no existing tests, new ground)
6. `atlas-notes` (embedding/vector mocking complexity)
7. Coverage config + final green run
