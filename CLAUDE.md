# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CI/CD verification rules

After every commit and push, verify the CI/CD pipeline:

```bash
# Check CI status after push
gh run list -R xaverric/atlas-lab --limit 3

# Watch a specific run
gh run watch <RUN_ID> -R xaverric/atlas-lab

# If build fails, check logs
gh run view <RUN_ID> -R xaverric/atlas-lab --log-failed
```

**Before pushing:** Always run `npm run lint && npm run typecheck && npm run test` locally.

**After pushing:** Verify Pipeline workflow passes on GitHub Actions (CI → Build → Security). If it fails, fix immediately before continuing other work.

**Security scans:** After build, Trivy scans all 8 Docker images. Results appear in GitHub Security tab (SARIF) and as downloadable artifacts (SBOM + vulnerability report). Critical vulnerabilities should be fixed immediately.

**Dependabot alerts:** Check `gh api repos/xaverric/atlas-lab/dependabot/alerts --jq '.[] | select(.state=="open")'` at conversation start. Fix open alerts proactively — update packages, verify tests pass, commit and push. Dashboard: https://github.com/xaverric/atlas-lab/security/dependabot

**Docker Hub images:** `xaverric/atlas-lab-atlas-*:latest` — pushed automatically on every main push.

**Docker Hub MCP:** Use `mcp__MCP_DOCKER__checkRepositoryTag` to verify images exist on Docker Hub after build.

## Testing

```bash
npm run test                  # run all tests
npm run test:watch            # watch mode
npm run test:coverage         # with coverage report
```

Vitest workspace with 7 projects. Tests live in `__tests__/` directories next to `src/`. Each backend service has `src/app.ts` (Express app factory) separate from `src/index.ts` (server startup) for testability with supertest.

## Commands

```bash
# Development (individual services with hot reload via tsx watch)
npm run dev:core              # port 4000
npm run dev:dms               # port 4001
npm run dev:scheduler         # port 4002
npm run dev:notify            # port 4003
npm run dev:notes             # port 4004
npm run dev:mcp               # port 4005
npm run dev:gui               # Next.js dev server, port 3000

# Build & check (all workspaces)
npm run build
npm run typecheck
npm run lint

# Per-workspace
npm -w @atlas/server run dev
npm -w @atlas/dms run dev
npm -w @atlas/notes run dev
npm -w @atlas/gui run dev

# Docker startup modes (from root, wraps deployment/startup.sh)
npm run start:prod            # Production: all services in Docker behind Traefik
npm run start:dev             # Dev: all services in Docker with dev compose overrides
npm run start:local           # Local: infra + backends in Docker, GUI runs locally (hot reload)
# Add --reset suffix to wipe volumes: npm run start:dev:reset

# Init data loader (Keycloak users/roles, MinIO buckets)
npm run init
```

## Architecture

**Monorepo** with npm workspaces. Node >= 22.

### Shared packages (no build step, consumed as raw TS via tsconfig `paths`)

- `packages/core` (`@atlas/core`) — `ApiError`, TypeScript types (`User`, `ApiResponse`, `PaginatedResponse`), Zod validators (`paginationSchema`, `objectIdSchema`), constants (`API_PREFIX = /api/v1`)
- `packages/server-common` (`@atlas/server-common`) — Express middleware: `createAuth` (Keycloak JWT verification), `validate` (Zod), `errorHandler`, `requireRole`, `connectDB` (Mongoose), `createLogger` (pino)

### Backend services

| Service         | Package            | Port | Purpose                                                                            | External deps                                    |
| --------------- | ------------------ | ---- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| atlas-core      | `@atlas/server`    | 4000 | User management, health                                                            | MongoDB                                          |
| atlas-dms       | `@atlas/dms`       | 4001 | Document storage, folders, sharing                                                 | MongoDB, MinIO (S3)                              |
| atlas-scheduler | `@atlas/scheduler` | 4002 | Job scheduling (cron/interval/once), executors (http/webhook/shell/script/monitor) | MongoDB, Redis (BullMQ)                          |
| atlas-notify    | `@atlas/notify`    | 4003 | Multi-channel notifications (email/Telegram), templates, preferences               | MongoDB, Redis (BullMQ), SMTP, Telegram API      |
| atlas-notes     | `@atlas/notes`     | 4004 | Notes knowledge base, semantic search                                              | MongoDB, Qdrant (vector DB), Ollama (embeddings) |
| atlas-mcp       | `@atlas/mcp`       | 4005 | MCP server — proxies all backend services for AI tool use                          | None (HTTP proxy)                                |

### Frontend

- `apps/atlas-gui` (`@atlas/gui`) — Next.js 15 (App Router), port 3000
- `lib/api.ts` routes requests by path prefix: `/api/v1/dms/*` → DMS_URL, `/api/v1/scheduler/*` → SCHEDULER_URL, `/api/v1/notes/*` → NOTES_URL, etc.
- Auth via `oidc-client-ts` → Keycloak. `AuthProvider` context wraps app, `lib/api.ts` attaches JWT and handles silent refresh on 401.
- Protected routes under `/(protected)/*` layout with auth guard.

### Infrastructure (Docker)

| Service  | Purpose                                                   |
| -------- | --------------------------------------------------------- |
| Traefik  | Reverse proxy, TLS (Let's Encrypt), subdomain routing     |
| Keycloak | OIDC auth (realm: atlas, SSO 8h, access token 30min)      |
| MongoDB  | Primary DB (each service uses own database)               |
| Redis    | BullMQ job queues (scheduler + notify only)               |
| MinIO    | S3-compatible file storage (DMS)                          |
| Qdrant   | Vector DB for semantic search (notes)                     |
| Ollama   | Local LLM embeddings — nomic-embed-text, 768 dims (notes) |

Production subdomains (`ATLAS_DOMAIN=xaverric.cz`): `xaverric.cz` (gui), `api.` (core), `dms.` (dms), `scheduler.` (scheduler), `notify.` (notify), `notes.` (notes), `mcp.` (mcp), `auth.` (keycloak), `s3.` (minio API), `storage.` (minio console)

### Backend layering

`Route → Controller → Service → DAO → Model`

- **Routes** mount auth/validation middleware (Zod schemas inline), delegate to controllers
- **Controllers** extract request data, call services, format `{ data: T }` responses. No business logic.
- **Services** contain business logic, throw `ApiError` for error cases
- **DAOs** wrap Mongoose queries. No business logic.
- **Models** define Mongoose schemas with `toJSON` virtual transform (`_id` → `id`, delete `__v`)

All routes under `API_PREFIX` (`/api/v1`), except `GET /health`.

### Auth

No custom auth — Keycloak handles everything.

1. Frontend `oidc-client-ts` redirects to Keycloak → callback exchanges code for tokens
2. `lib/api.ts` attaches access token, handles 401 with `signinSilent()`
3. Backend `createAuth()` verifies JWT against Keycloak JWKS endpoint
4. `req.auth` = decoded token (sub, email, name, realm_access.roles)
5. Inter-service auth (scheduler → notify): `X-Internal-Key` header
6. MCP server forwards user's JWT to backend services (no service account)

### Key service interactions

- **scheduler → notify**: Job success/failure hooks send HTTP POST with `X-Internal-Key` to queue a notification
- **notes → ollama → qdrant**: On note save, fire-and-forget generates embedding via Ollama, upserts to Qdrant. Search embeds query text → Qdrant vector similarity.
- **dms → minio**: Two S3 clients — internal (MINIO_ENDPOINT) for uploads, public (MINIO_PUBLIC_URL) for presigned download/preview URLs
- **mcp → all backends**: HTTP proxy with JWT passthrough. Streamable HTTP transport on `/mcp` endpoint. 62 tools across all services.

## Key conventions

- API responses: `{ data: T }` for success, `{ error: string, details?: {} }` for errors
- All inputs validated with Zod in `validate()` middleware
- Config from env vars with local defaults (`config/index.ts` in each service)
- `@atlas/core` and `@atlas/server-common` imported as source TS — no dist, no build
- Next.js uses `output: 'standalone'` for Docker builds
- Mongoose models use `toJSON` transform: `_id` → `id`, strip `__v`
- Qdrant point IDs: MongoDB ObjectId converted to UUID format (zero-padded)
- Notes store markdown in MongoDB, TipTap editor works with HTML, convert on load/save via turndown/showdown
