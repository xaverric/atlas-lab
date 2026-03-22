# Atlas Lab

[![Pipeline](https://github.com/xaverric/atlas-lab/actions/workflows/pipeline.yml/badge.svg)](https://github.com/xaverric/atlas-lab/actions/workflows/pipeline.yml)
[![Nightly](https://github.com/xaverric/atlas-lab/actions/workflows/nightly.yml/badge.svg)](https://github.com/xaverric/atlas-lab/actions/workflows/nightly.yml)
[![Release](https://github.com/xaverric/atlas-lab/actions/workflows/release.yml/badge.svg)](https://github.com/xaverric/atlas-lab/actions/workflows/release.yml)

Personal platform — file storage, notes, job scheduler, notifications, and more. Monorepo with 8 microservices, Next.js frontend, and full Docker infrastructure.

## Services

| Service | Port | Docker Hub | Description |
|---------|------|------------|-------------|
| atlas-core | 4000 | [`atlas-lab-atlas-core`](https://hub.docker.com/r/xaverric/atlas-lab-atlas-core) | User management, health, system dashboard |
| atlas-dms | 4001 | [`atlas-lab-atlas-dms`](https://hub.docker.com/r/xaverric/atlas-lab-atlas-dms) | Document storage, folders, sharing (MinIO S3) |
| atlas-scheduler | 4002 | [`atlas-lab-atlas-scheduler`](https://hub.docker.com/r/xaverric/atlas-lab-atlas-scheduler) | Job scheduling — cron, interval, once, JS/shell/webhook executors |
| atlas-notify | 4003 | [`atlas-lab-atlas-notify`](https://hub.docker.com/r/xaverric/atlas-lab-atlas-notify) | Multi-channel notifications (email, Telegram, push, in-app) |
| atlas-notes | 4004 | [`atlas-lab-atlas-notes`](https://hub.docker.com/r/xaverric/atlas-lab-atlas-notes) | Notes knowledge base with semantic search (Qdrant + Ollama) |
| atlas-mcp | 4005 | [`atlas-lab-atlas-mcp`](https://hub.docker.com/r/xaverric/atlas-lab-atlas-mcp) | MCP server — AI tool proxy for all backend services |
| atlas-tracker | 4006 | [`atlas-lab-atlas-tracker`](https://hub.docker.com/r/xaverric/atlas-lab-atlas-tracker) | Activity tracking with dynamic schemas |
| atlas-gui | 3000 | [`atlas-lab-atlas-gui`](https://hub.docker.com/r/xaverric/atlas-lab-atlas-gui) | Next.js 15 frontend (App Router, Catppuccin theme) |

## Tech Stack

**Backend:** Node.js 22, Express, TypeScript, Mongoose, BullMQ, Zod

**Frontend:** Next.js 15, React 19, TailwindCSS 4, TipTap, oidc-client-ts

**Infrastructure:** Docker, Traefik, Keycloak, MongoDB, Redis, MinIO, Qdrant, Ollama

**CI/CD:** GitHub Actions, Docker Hub, Vitest

## Quick Start

```bash
# Development (all services in Docker)
npm run start:dev

# Local (infra in Docker, GUI locally with hot reload)
npm run start:local
npm run dev:gui

# Production
npm run start:prod
```

## Development

```bash
npm install
npm run typecheck       # type check all workspaces
npm run test            # run all tests
npm run dev:core        # start individual service with hot reload
```

## Architecture

```
Route → Controller → Service → DAO → Model
```

Monorepo with npm workspaces. Shared packages (`@atlas/core`, `@atlas/server-common`, `@atlas/event-bus`) consumed as raw TypeScript via tsconfig paths.

Auth via Keycloak (OIDC). Frontend attaches JWT, backend verifies against JWKS. Inter-service auth via `X-Internal-Key` header.

## CI/CD

| Workflow | Trigger | Action |
|----------|---------|--------|
| CI | push to main, PRs, feature/* | typecheck + tests |
| Build & Push | push to main, tags | build Docker images, push to Docker Hub |
| Nightly | cron 2:00 UTC | full rebuild + push with nightly tag |
| Release | tag v* | GitHub Release + release branch |

## License

Private
