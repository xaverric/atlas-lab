# 11 — CI/CD & GitOps

## Current State

- `.github/workflows/ci.yml` and `deploy.yml` exist (staged, content unknown — likely scaffolds)
- Docker Compose for deployment (dev + prod)
- `startup.sh` handles Docker Compose orchestration
- Traefik for routing with Let's Encrypt TLS
- No automated deployment pipeline to VPS
- No versioning strategy

## Goals

- Automated CI: build, typecheck, lint on every push/PR
- Automated CD: push to main → deploy to VPS
- Production upgrades: never reset, only upgrade running services
- Per-service versioning for targeted deployments

### Key Principle: Never Reset Production

Production environment must support rolling upgrades. No `docker-compose down && up`. No volume resets. MongoDB data, MinIO files, Keycloak config — all must persist across deployments.

## CI Pipeline

### GitHub Actions — CI

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build

  docker:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker images
        run: |
          docker build -t atlas-core:${{ github.sha }} ./apps/atlas-core
          docker build -t atlas-gui:${{ github.sha }} ./apps/atlas-gui
          # ... other services with Dockerfiles

      - name: Push to registry
        run: |
          # Push to GitHub Container Registry or private registry
          echo "${{ secrets.GHCR_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          for img in atlas-core atlas-gui; do
            docker tag $img:${{ github.sha }} ghcr.io/${{ github.repository }}/$img:${{ github.sha }}
            docker tag $img:${{ github.sha }} ghcr.io/${{ github.repository }}/$img:latest
            docker push ghcr.io/${{ github.repository }}/$img:${{ github.sha }}
            docker push ghcr.io/${{ github.repository }}/$img:latest
          done
```

### Docker Images

Currently only `atlas-core` and `atlas-gui` have Dockerfiles. Need Dockerfiles for:
- `apps/atlas-dms/Dockerfile`
- `apps/atlas-scheduler/Dockerfile`
- `apps/atlas-notify/Dockerfile`
- `apps/atlas-notes/Dockerfile`
- `apps/atlas-tracker/Dockerfile` (when built)
- `apps/atlas-claude/Dockerfile` (when built)

**Dockerfile pattern for backend services:**
```dockerfile
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/atlas-SERVICE/ ./apps/atlas-SERVICE/
RUN npm ci --workspace=@atlas/SERVICE

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app .
ENV NODE_ENV=production
EXPOSE PORT
CMD ["npx", "tsx", "apps/atlas-SERVICE/src/index.ts"]
```

## CD Pipeline — Deploy to VPS

### GitHub Actions — Deploy

`.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      services:
        description: 'Services to deploy (comma-separated, or "all")'
        default: 'all'

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: [ci]  # wait for CI to pass
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to VPS via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/atlas-lab
            git pull origin main

            # Pull latest images
            docker compose -f deployment/docker-compose.yml pull

            # Rolling restart (no down/up — preserves volumes)
            docker compose -f deployment/docker-compose.yml up -d --no-deps --build atlas-core
            docker compose -f deployment/docker-compose.yml up -d --no-deps --build atlas-gui
            docker compose -f deployment/docker-compose.yml up -d --no-deps --build atlas-dms
            docker compose -f deployment/docker-compose.yml up -d --no-deps --build atlas-scheduler
            docker compose -f deployment/docker-compose.yml up -d --no-deps --build atlas-notify
            docker compose -f deployment/docker-compose.yml up -d --no-deps --build atlas-notes

            # Verify health
            sleep 10
            for svc in api dms scheduler notify notes; do
              curl -sf https://$svc.xaverric.cz/health || echo "WARNING: $svc health check failed"
            done
```

### Selective Deployment

Deploy only changed services:

```yaml
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      core: ${{ steps.changes.outputs.core }}
      dms: ${{ steps.changes.outputs.dms }}
      gui: ${{ steps.changes.outputs.gui }}
      scheduler: ${{ steps.changes.outputs.scheduler }}
      notify: ${{ steps.changes.outputs.notify }}
      notes: ${{ steps.changes.outputs.notes }}
      packages: ${{ steps.changes.outputs.packages }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2
      - uses: dorny/paths-filter@v3
        id: changes
        with:
          filters: |
            core: 'apps/atlas-core/**'
            dms: 'apps/atlas-dms/**'
            gui: 'apps/atlas-gui/**'
            scheduler: 'apps/atlas-scheduler/**'
            notify: 'apps/atlas-notify/**'
            notes: 'apps/atlas-notes/**'
            packages: 'packages/**'
```

If `packages` changed → redeploy all services (shared code).
Otherwise → only redeploy changed services.

### Rolling Update Strategy

**Critical: No downtime approach**

```bash
# Per-service rolling update
docker compose up -d --no-deps --build atlas-core

# This:
# 1. Builds new image (if needed)
# 2. Stops old container
# 3. Starts new container
# 4. Preserves all volumes (data, configs)
# 5. Does NOT touch other services
```

**For zero-downtime (future):** Use `deploy.replicas: 2` with health checks so Traefik routes to healthy instance while other updates.

### Production Upgrade Checklist

When deploying to production:

1. **Never** use `docker compose down` (destroys containers)
2. **Never** use `--volumes` or `-v` flags (destroys data)
3. **Always** use `--no-deps` for service-specific restarts
4. **Always** verify health after deployment
5. **MongoDB migrations** — run as part of service startup (not separate step)
6. **Environment changes** — update `.env` on VPS, then restart affected services

### Versioning Strategy

Use git tags for versions:
```
git tag -a v1.2.3 -m "Release 1.2.3: added git executor, fixed DMS sharing"
git push origin v1.2.3
```

Each service reads version from `package.json` or `APP_VERSION` env var.

**Deployment emits audit event** (see 08-event-log-audit):
```
POST /api/v1/audit/events
{
  action: 'deployment.completed',
  details: {
    version: 'v1.2.3',
    services: ['atlas-scheduler'],
    commitHash: 'abc123'
  }
}
```

### VPS Setup

**Prerequisites on VPS:**
- Docker + Docker Compose installed
- Git repository cloned to `/opt/atlas-lab`
- SSH key for GitHub Actions access
- `.env` file with production secrets
- Let's Encrypt cert auto-renewal via Traefik

**GitHub Secrets needed:**
```
VPS_HOST          — VPS IP or hostname
VPS_USER          — SSH user (with docker access)
VPS_SSH_KEY       — SSH private key
GHCR_TOKEN        — GitHub Container Registry token (if using)
```

### MongoDB Migrations

For schema changes, use startup migration pattern:

```
// In service index.ts
import { runMigrations } from './migrations';

await connectDB();
await runMigrations();  // idempotent migrations
app.listen(port);
```

Migration pattern (already used in atlas-notify: `src/migrations/migratePreferences.ts`):
```
async function runMigrations() {
  const migrationLog = db.collection('_migrations');

  const migrations = [
    { name: '001-add-visibility-to-folders', fn: addVisibilityToFolders },
    { name: '002-add-createdBy-index', fn: addCreatedByIndex },
  ];

  for (const m of migrations) {
    const ran = await migrationLog.findOne({ name: m.name });
    if (!ran) {
      await m.fn();
      await migrationLog.insertOne({ name: m.name, ranAt: new Date() });
    }
  }
}
```

## Implementation Order

1. **Dockerfiles** — create missing Dockerfiles for all services
2. **CI workflow** — build, typecheck, lint
3. **VPS setup** — clone repo, configure .env, verify Docker
4. **Deploy workflow** — SSH-based deployment with rolling restarts
5. **Change detection** — selective deployment based on changed files
6. **Health verification** — post-deploy health checks
7. **Versioning** — git tags, version in package.json
8. **Migration framework** — startup migration pattern for all services

## Dependencies

- VPS with Docker + Docker Compose
- GitHub repository with Actions enabled
- SSH key pair for VPS access from GitHub Actions
- DNS configured for all subdomains → VPS IP
- TLS via Traefik + Let's Encrypt
