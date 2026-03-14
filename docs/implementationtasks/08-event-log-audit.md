# 08 — Event Log & Audit

## Current State

- No centralized event logging
- Each service has its own pino logger (`packages/server-common/src/config/logger.ts`)
- No audit trail of user actions
- No deployment version tracking

## Goals

Build a cross-service audit logging system that captures all significant events: API calls, user actions, system events, deployments. Provide a GUI for browsing and searching the event log.

### Business Case

- Security: know who did what and when
- Debugging: trace issues across services
- Compliance: audit trail for sensitive operations
- Operations: track deployments with release notes and change history

## Architecture

### Approach: Shared Event Log via packages/event-bus

The `packages/event-bus` already exists with types, matching, and bus logic. Extend this to persist events.

**Two options:**

#### A. Centralized Event Log Service (new service)
- Dedicated `atlas-audit` service
- All services POST events to it
- Single MongoDB collection for all events
- Pros: clean separation, easy to query
- Cons: another service to deploy, network overhead

#### B. Shared Middleware + Direct MongoDB Writes (simpler)
- Add audit middleware to `packages/server-common`
- Each service writes to a shared `atlas-audit` database directly
- Pros: no new service, simpler
- Cons: shared database, harder to manage

**Recommended: Option B** — shared middleware approach. Add audit collection to atlas-core's database or a shared audit database.

### Event Schema

```
{
  _id: ObjectId,
  timestamp: Date,
  service: string,           // 'atlas-core', 'atlas-dms', 'atlas-scheduler', etc.
  action: string,            // 'document.upload', 'job.create', 'user.login', etc.
  category: string,          // 'api', 'auth', 'system', 'deployment'
  userId: string,            // Keycloak sub (null for system events)
  userName: string,          // for display
  resource: {
    type: string,            // 'document', 'folder', 'job', 'note', etc.
    id: string,              // resource ID
    name: string             // resource name for display
  },
  details: object,           // action-specific metadata
  request: {
    method: string,
    path: string,
    ip: string,
    userAgent: string
  },
  result: {
    status: 'success' | 'error',
    statusCode: number,
    errorMessage: string     // if error
  },
  duration: number           // request duration in ms
}
```

### Audit Middleware

`packages/server-common/src/middleware/audit.ts`:
```
function createAuditMiddleware(serviceName: string, auditDb: Connection) {
  const AuditLog = auditDb.model('AuditLog', auditLogSchema);

  return (req, res, next) => {
    const start = Date.now();

    // Capture response
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - start;

      // Determine action from route
      const action = resolveAction(req.method, req.path);

      // Skip health checks and other noise
      if (shouldSkip(req.path)) return originalEnd.apply(res, args);

      AuditLog.create({
        timestamp: new Date(),
        service: serviceName,
        action,
        category: 'api',
        userId: req.auth?.sub,
        userName: req.auth?.name,
        resource: extractResource(req),
        details: extractDetails(req),
        request: {
          method: req.method,
          path: req.path,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        },
        result: {
          status: res.statusCode < 400 ? 'success' : 'error',
          statusCode: res.statusCode
        },
        duration
      }).catch(err => logger.error('Audit log write failed', err));

      return originalEnd.apply(res, args);
    };

    next();
  };
}
```

**Action resolution:** Map `METHOD + path pattern` → action name:
```
const actionMap = {
  'POST /api/v1/dms/documents': 'document.upload',
  'DELETE /api/v1/dms/documents/:id': 'document.delete',
  'POST /api/v1/scheduler/jobs': 'job.create',
  'POST /api/v1/notes': 'note.create',
  // ...
};
```

Or simpler: auto-generate from `{method}.{resource}` based on path segments.

### Integration per Service

Each service adds the audit middleware in its Express setup:

`apps/atlas-*/src/index.ts`:
```
import { createAuditMiddleware } from '@atlas/server-common';

const auditDb = mongoose.createConnection(config.AUDIT_MONGODB_URI);
app.use(createAuditMiddleware('atlas-dms', auditDb));
```

**Config addition** per service:
```
AUDIT_MONGODB_URI: process.env.AUDIT_MONGODB_URI || 'mongodb://localhost:27017/atlas-audit'
```

### Deployment Event Tracking

Track deployments as special audit events:

```
{
  service: 'atlas-system',
  action: 'deployment.completed',
  category: 'deployment',
  details: {
    version: '1.2.3',
    previousVersion: '1.2.2',
    releaseNotes: 'Added git executor, fixed bug #123',
    deployedBy: 'ci/cd',
    commitHash: 'abc123',
    services: ['atlas-scheduler', 'atlas-gui']
  }
}
```

**How to emit:** CI/CD pipeline POSTs to audit API after successful deployment. Or each service emits a startup event with its version.

**Service startup event:**
```
// In each service's index.ts, after Express starts:
auditLog.create({
  service: serviceName,
  action: 'service.started',
  category: 'system',
  details: {
    version: process.env.APP_VERSION || 'dev',
    nodeVersion: process.version,
    uptime: process.uptime()
  }
});
```

### Querying Events

**API (in atlas-core or dedicated route):**
```
GET /api/v1/audit/events
  ?service=atlas-dms
  &action=document.upload
  &category=api
  &userId=user-sub-id
  &from=2024-01-01T00:00:00Z
  &to=2024-12-31T23:59:59Z
  &status=error
  &sort=timestamp:desc
  &limit=50
  &offset=0
```

**Indexes for performance:**
```
{ timestamp: -1 }
{ service: 1, timestamp: -1 }
{ userId: 1, timestamp: -1 }
{ action: 1, timestamp: -1 }
{ category: 1, timestamp: -1 }
{ 'resource.type': 1, 'resource.id': 1 }
```

### GUI — Event Log Browser

`apps/atlas-gui/src/app/(protected)/audit/page.tsx`:
- Table with columns: Timestamp, Service, Action, User, Resource, Status, Duration
- Filters: service dropdown, action text search, date range, user, status
- Click row → expand details panel
- Real-time updates via SSE (optional)
- Export to CSV

`apps/atlas-gui/src/components/audit/`:
```
event-table.tsx        — main event list table
event-filters.tsx      — filter bar (service, action, date, user)
event-detail.tsx       — expanded event detail view
deployment-timeline.tsx — visual timeline of deployments
```

**Sidebar:** Add "Audit Log" under admin section (admin-only access).

### Data Retention

- Default: keep events for 90 days
- Configurable per category (deployment events kept longer)
- MongoDB TTL index: `{ timestamp: 1 }, { expireAfterSeconds: 90 * 86400 }`
- Or: scheduled job in atlas-scheduler to archive/purge old events

### Events to Skip

Don't log:
- `GET /health` — too noisy
- Static asset requests
- Preflight CORS requests (OPTIONS)
- Internal service-to-service health checks

## Implementation Order

1. **Audit schema + middleware** — `packages/server-common/src/middleware/audit.ts`
2. **Integrate into atlas-core** — test with one service first
3. **Roll out to all services** — add middleware to each
4. **Query API** — add event query endpoint to atlas-core
5. **GUI — event table** — basic list with filters
6. **Deployment events** — CI/CD integration
7. **TTL + retention** — auto-cleanup

## Dependencies

- Shared MongoDB connection to `atlas-audit` database from all services
- `packages/server-common` needs the audit middleware exported
- GUI sidebar update for admin-only "Audit Log" link
- CI/CD pipeline (see 11-cicd-gitops) for deployment event emission
