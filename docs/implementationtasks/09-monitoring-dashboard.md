# 09 — Monitoring Dashboard

## Current State

- Each service has `GET /health` endpoint
- No centralized monitoring
- No external service checks
- Infrastructure services (Redis, Mongo, MinIO, Keycloak) have no visibility in the GUI

## Goals

Build a system monitoring dashboard showing infrastructure health, service status, and external service availability. Provide quick links and connection info for all infrastructure components.

### Business Case

- Single pane of glass for all atlas infrastructure
- Know immediately when something is down
- Monitor external services (work-related endpoints)
- Quick access to admin UIs (MinIO console, Keycloak admin, BullMQ dashboard)

## Architecture

### Two parts:

1. **Infrastructure Info Panel** — static links + live status
2. **Service Monitor** — periodic health checks with history

### Infrastructure Info Panel

**Data to display:**

| Component | URL/Address | Purpose | Admin UI |
|-----------|-------------|---------|----------|
| MongoDB | mongo:27017 | Primary database | — |
| Redis | redis:6379 | BullMQ job queues | — |
| MinIO | minio:9000 (API), storage.xaverric.cz (console) | S3 file storage | MinIO Console |
| Keycloak | auth.xaverric.cz | Authentication | Keycloak Admin |
| Qdrant | qdrant:6333 | Vector search | Qdrant Dashboard |
| Ollama | ollama:11434 | AI embeddings | — |
| Traefik | — | Reverse proxy | Traefik Dashboard |
| n8n | n8n.xaverric.cz | Workflow automation | n8n UI |

**Implementation:** Mostly static configuration with live status checks.

`apps/atlas-gui/src/app/(protected)/monitoring/page.tsx`:
- Grid of infrastructure cards
- Each card: name, status indicator (green/red), address, link to admin UI
- Connection details (click to expand)

### Service Health Monitoring

**Check atlas services:**
```
GET https://api.xaverric.cz/health        — atlas-core
GET https://dms.xaverric.cz/health        — atlas-dms
GET https://scheduler.xaverric.cz/health  — atlas-scheduler
GET https://notify.xaverric.cz/health     — atlas-notify
GET https://notes.xaverric.cz/health      — atlas-notes
```

**Check infrastructure:**
- MongoDB: `mongoose.connection.readyState`
- Redis: `redis.ping()`
- MinIO: `mc admin info`
- Qdrant: `GET /collections`
- Ollama: `GET /api/tags`

**Backend monitoring endpoint:**

Add to atlas-core (or new monitoring route):

`apps/atlas-core/src/routes/monitoring.ts`:
```
GET /api/v1/monitoring/status       — all service statuses
GET /api/v1/monitoring/infra        — infrastructure health
GET /api/v1/monitoring/external     — external service checks
GET /api/v1/monitoring/history      — historical check data
```

**Service:**

`apps/atlas-core/src/services/monitoringService.ts`:
```
class MonitoringService {
  async checkAllServices(): Promise<ServiceStatus[]> {
    const services = [
      { name: 'atlas-core', url: config.CORE_HEALTH_URL },
      { name: 'atlas-dms', url: config.DMS_HEALTH_URL },
      { name: 'atlas-scheduler', url: config.SCHEDULER_HEALTH_URL },
      { name: 'atlas-notify', url: config.NOTIFY_HEALTH_URL },
      { name: 'atlas-notes', url: config.NOTES_HEALTH_URL },
    ];

    return Promise.all(services.map(async (svc) => {
      const start = Date.now();
      try {
        const res = await fetch(svc.url, { signal: AbortSignal.timeout(5000) });
        return {
          name: svc.name,
          status: res.ok ? 'healthy' : 'unhealthy',
          responseTime: Date.now() - start,
          statusCode: res.status,
          checkedAt: new Date()
        };
      } catch (err) {
        return {
          name: svc.name,
          status: 'down',
          responseTime: Date.now() - start,
          error: err.message,
          checkedAt: new Date()
        };
      }
    }));
  }

  async checkInfrastructure(): Promise<InfraStatus[]> {
    // Check MongoDB, Redis, MinIO, Qdrant, Ollama
    // Each with try/catch and timeout
  }
}
```

### External Service Monitoring

**Services to monitor (from user notes):**

| Service | URL | Purpose |
|---------|-----|---------|
| Codebase | codebase URL | Code repository |
| Codebaseg02 | codebaseg02 URL | Code repository v2 |
| Plus4U unsafe packages | check URL | Security package check |
| Nexus NPM | repo.plus4u.net/repository/public-javascript/ | NPM registry |
| Nexus/Harbor | harbor URL | Container registry |
| uu_cloudg02-devkit | repo.plus4u.net/repository/public-javascript/uu_cloudg02-devkit | DevKit package |

**Configurable check list:**

Store external service checks in MongoDB (or config file):
```
{
  name: string,
  url: string,
  method: 'GET' | 'HEAD',
  expectedStatus: number,      // 200, 301, etc.
  timeout: number,             // ms
  interval: number,            // check interval in seconds
  headers: object,             // optional auth headers
  enabled: boolean
}
```

**Scheduled checks:** Use atlas-scheduler to run monitoring checks periodically (every 5 min). Store results in MongoDB for historical view.

Or: built-in interval in monitoring service (simpler, no scheduler dependency).

### History Storage

**Model:**
```
{
  serviceName: string,
  serviceType: 'atlas' | 'infrastructure' | 'external',
  status: 'healthy' | 'unhealthy' | 'down',
  responseTime: number,
  statusCode: number,
  error: string,
  checkedAt: Date
}
```

**Indexes:**
```
{ serviceName: 1, checkedAt: -1 }
{ checkedAt: 1 }, { expireAfterSeconds: 7 * 86400 }  // keep 7 days
```

### GUI

`apps/atlas-gui/src/app/(protected)/monitoring/page.tsx`:

**Layout — three sections:**

#### 1. Atlas Services
- Row of status cards, one per service
- Each card: service name, status badge (green/yellow/red), response time, last checked
- Click → detail panel with check history chart

#### 2. Infrastructure
- Grid of infrastructure cards
- Each: component name, status, admin UI link (opens in new tab)
- Connection info (collapsible): host, port, credentials reference
- Quick actions: "Open Console", "View Logs"

#### 3. External Services
- Table: name, URL, status, response time, last check, uptime %
- Add/edit/remove external checks
- Expandable row with response time history chart

**Components:**

`apps/atlas-gui/src/components/monitoring/`:
```
service-status-card.tsx     — atlas service status display
infra-card.tsx              — infrastructure component card
external-check-table.tsx    — external service monitoring table
status-badge.tsx            — green/yellow/red indicator
response-time-chart.tsx     — mini sparkline chart for history
uptime-bar.tsx              — visual uptime percentage bar
check-config-dialog.tsx     — add/edit external check
```

**Auto-refresh:** Poll monitoring endpoint every 30 seconds, or use SSE for real-time updates.

### Configuration

**Config for atlas-core:**
```
MONITORING_CHECK_INTERVAL: 300000,  // 5 minutes
DMS_HEALTH_URL: process.env.DMS_HEALTH_URL || 'http://atlas-dms:4001/health',
SCHEDULER_HEALTH_URL: process.env.SCHEDULER_HEALTH_URL || 'http://atlas-scheduler:4002/health',
NOTIFY_HEALTH_URL: process.env.NOTIFY_HEALTH_URL || 'http://atlas-notify:4003/health',
NOTES_HEALTH_URL: process.env.NOTES_HEALTH_URL || 'http://atlas-notes:4004/health',
```

## Implementation Order

1. **Health check aggregation** — monitoring service in atlas-core, check all atlas services
2. **Infrastructure checks** — add Mongo/Redis/MinIO/Qdrant/Ollama status
3. **GUI — status dashboard** — service cards + infra cards
4. **External service checks** — configurable URL monitoring
5. **History storage + charts** — store check results, display trends
6. **Auto-refresh** — periodic polling in GUI

## Dependencies

- atlas-core needs network access to all service health endpoints
- Infrastructure checks need client connections (Mongoose for Mongo, ioredis for Redis, etc.)
- External checks may need specific auth headers (configure per check)
- GUI needs chart library for response time history (recharts or similar — check if already in dependencies)
