# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev:core              # Express backend with hot reload (tsx watch, port 4000)
npm run dev:dms               # DMS backend (port 4001)
npm run dev:scheduler         # Scheduler backend (port 4002)
npm run dev:notify            # Notification backend (port 4003)
npm run dev:gui               # Next.js frontend dev server (port 3000)

# Build & check (all workspaces)
npm run build
npm run typecheck
npm run lint

# Per-workspace
npm -w @atlas/server run dev
npm -w @atlas/dms run dev
npm -w @atlas/scheduler run dev
npm -w @atlas/notify run dev
npm -w @atlas/gui run dev

# Docker (from deployment/)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up   # Local dev

# Init data loader
npm run init
```

## Architecture

**Monorepo** with npm workspaces. Packages:

- `packages/core` (`@atlas/core`) — shared TypeScript types, `ApiError` class, Zod validators, constants. No build step; consumed as raw TS via `transpilePackages` (Next.js) and `paths` (backend tsconfig).
- `packages/server-common` (`@atlas/server-common`) — shared Express middleware (`createAuth`, `validate`, `errorHandler`, `requireRole`), `connectDB`, `createLogger` (pino). Used by all backend services.
- `apps/atlas-core` (`@atlas/server`) — Express REST API on port 4000 (users, health)
- `apps/atlas-dms` (`@atlas/dms`) — Document Management Service on port 4001 (MinIO storage, presigned URLs, share tokens)
- `apps/atlas-scheduler` (`@atlas/scheduler`) — Job Scheduler on port 4002 (BullMQ, cron/interval/once, executors: http/webhook/script/shell/monitor)
- `apps/atlas-notify` (`@atlas/notify`) — Notification Service on port 4003 (email via nodemailer, Telegram bot, BullMQ delivery workers)
- `apps/atlas-gui` (`@atlas/gui`) — Next.js 15 frontend on port 3000
- `deployment/atlas-init` (`@atlas/init`) — Data initialization loader (Keycloak users/roles, realm settings, MinIO buckets)

### Infrastructure (Docker)

- **Traefik** — reverse proxy, TLS via Let's Encrypt, path-based routing per service
- **Keycloak** — OIDC auth (realm: atlas, SSO 8h idle/max, 30min access token)
- **MongoDB** — primary database (each service uses its own DB)
- **Redis** — BullMQ job queues (scheduler + notify)
- **MinIO** — S3-compatible file storage (DMS)

### Backend layering

`Route → Controller → Service → DAO → Model`

- **Routes** mount auth/validation middleware, delegate to controllers
- **Controllers** extract request data, call services, format responses. No business logic.
- **Services** contain business logic, throw `ApiError` for error cases
- **DAOs** wrap Mongoose queries. No business logic.
- **Models** define Mongoose schemas with `toJSON` virtual transform (`_id` → `id`)

All routes live under `API_PREFIX` (`/api/v1`), except `GET /health`.

### Auth flow (OIDC)

No custom auth — Keycloak handles login, token issuance, user management.

1. Frontend `oidc-client-ts` redirects to Keycloak (`/login` → `signinRedirect()`)
2. Keycloak returns auth code to `/callback` → `signinRedirectCallback()` exchanges for tokens
3. `lib/api.ts` attaches access token to all API requests, handles 401 with `signinSilent()`
4. Backend `createAuth()` from `@atlas/server-common` verifies JWT against Keycloak JWKS endpoint
5. `req.auth` contains decoded token payload (sub, email, name, realm_access.roles)
6. Inter-service auth (notify): `X-Internal-Key` header

### Frontend routing

- `/`, `/login`, `/callback` — public pages
- `/(protected)/*` — auth guard in route group layout, redirects unauthenticated users
- `/(protected)/dms/*` — Document Management
- `/(protected)/scheduler/*` — Job Scheduler
- `/(protected)/notifications/*` — Notifications
- Auth state via React context (`AuthProvider` wraps app in root layout)
- `lib/api.ts` routes requests to correct backend service by path prefix

## Key conventions

- All inputs validated with Zod schemas in `validate()` middleware
- Config from environment variables with local defaults (`config/index.ts`)
- `@atlas/core` and `@atlas/server-common` have no dist — imported as source TS via tsconfig `paths` aliases
- Next.js uses `output: 'standalone'` for Docker builds
- Keycloak realm config exported to `deployment/keycloak/atlas-realm.json` for reproducible dev setup
- API responses: `{ data: T }` for success, `{ error: string, details?: {} }` for errors
- Role-based access: `requireRole('admin')` middleware from `@atlas/server-common`
- Structured logging: `createLogger('service-name')` from `@atlas/server-common` (pino)
