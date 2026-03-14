# atlas-scheduler (@atlas/scheduler)

Job scheduling and execution service. Supports cron, one-time, and interval schedules with multiple executor types. Powered by BullMQ + Redis.

## Port: 4002

## Architecture

```
Route → Controller → Service → DAO → Model
                        ↓
                   BullMQ Queue
                        ↓
                   Worker → Executor → ExecutionResult → Execution record
```

## API Endpoints

### Jobs (all require auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/scheduler/jobs` | Create job |
| GET | `/api/v1/scheduler/jobs` | List jobs (paginated) |
| GET | `/api/v1/scheduler/jobs/:id` | Get job detail |
| PATCH | `/api/v1/scheduler/jobs/:id` | Update job |
| DELETE | `/api/v1/scheduler/jobs/:id` | Delete job |
| POST | `/api/v1/scheduler/jobs/:id/run` | Trigger manual execution |
| PATCH | `/api/v1/scheduler/jobs/:id/toggle` | Enable/disable job |

### Executions (all require auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/scheduler/executions?jobId=...` | List executions for a job |
| GET | `/api/v1/scheduler/executions/:id` | Get execution detail |

## Job Types (Executors)

### `http`
Makes an HTTP request and captures the response.

```json
{
  "type": "http",
  "config": {
    "url": "https://api.example.com/data",
    "method": "GET",
    "headers": { "X-API-Key": "..." },
    "body": { "key": "value" }
  }
}
```

### `webhook`
Sends a POST request with a JSON payload.

```json
{
  "type": "webhook",
  "config": {
    "url": "https://hooks.example.com/trigger",
    "payload": { "event": "deploy", "env": "production" }
  }
}
```

### `shell`
Executes a shell command via `/bin/sh -c`. Captures stdout, stderr, exit code.

```json
{
  "type": "shell",
  "config": {
    "command": "pg_dump mydb | gzip > /backups/$(date +%F).sql.gz"
  }
}
```

Security: Uses `child_process.execFile` with `/bin/sh`, configurable timeout, max output buffer 50KB.

### `script`
Executes a Node.js script in a forked child process (not `eval`).

```json
{
  "type": "script",
  "config": {
    "code": "const res = await fetch('https://api.example.com');\nconsole.log(await res.json());"
  }
}
```

Script is written to a temp `.mjs` file, forked, then cleaned up.

### `monitor`
HTTP health check with assertions.

```json
{
  "type": "monitor",
  "config": {
    "url": "https://mysite.com/health",
    "expectedStatus": 200,
    "expectedBody": "\"status\":\"ok\""
  }
}
```

Fails if status code doesn't match or response body doesn't contain expected string.

## Schedule Types

| Type | Field | Description |
|------|-------|-------------|
| `cron` | `cron: "*/5 * * * *"` | Standard cron expression |
| `once` | `runAt: "2024-12-25T00:00:00Z"` | Run at a specific time |
| `interval` | `intervalMs: 60000` | Repeat every N milliseconds |

## Execution Result

```ts
{
  exitCode?: number,      // shell/script
  statusCode?: number,    // http/webhook/monitor
  stdout?: string,        // shell/script (max 50KB)
  stderr?: string,        // shell/script (max 50KB)
  body?: string,          // http/webhook/monitor response (max 10KB)
  error?: string          // error message if failed
}
```

## Hooks (per-job)

Jobs support `onSuccess` and `onFailure` hooks for notification piping:

```json
{
  "onSuccess": { "notify": { "templateKey": "job-success", "channel": "telegram" } },
  "onFailure": { "notify": { "templateKey": "job-failure", "channel": "email" } }
}
```

## Data Models

### Job

| Field | Type | Description |
|-------|------|-------------|
| name | string | Job name |
| description | string | Optional description |
| type | enum | `http`, `webhook`, `script`, `shell`, `monitor` |
| enabled | boolean | Whether scheduling is active |
| ownerId | string | Keycloak sub |
| scheduleType | enum | `cron`, `once`, `interval` |
| cron | string | Cron expression (if scheduleType=cron) |
| runAt | Date | Target time (if scheduleType=once) |
| intervalMs | number | Interval in ms (if scheduleType=interval) |
| config | Mixed | Executor-specific configuration |
| timeoutMs | number | Execution timeout (default: 30000) |
| onSuccess | Hook | Notification hook on success |
| onFailure | Hook | Notification hook on failure |

### Execution

| Field | Type | Description |
|-------|------|-------------|
| jobId | ObjectId | Reference to Job |
| status | enum | `pending`, `running`, `completed`, `failed`, `timeout` |
| startedAt | Date | Execution start |
| completedAt | Date | Execution end |
| duration | number | Duration in ms |
| result | Object | Executor output (see above) |
| triggeredBy | enum | `schedule` or `manual` |

## BullMQ Details

- Queue name: `atlas-scheduler`
- Worker concurrency: 5
- On startup: syncs all enabled jobs from MongoDB to BullMQ
- Cron/interval jobs use `queue.upsertJobScheduler()`
- One-time jobs use delayed `queue.add()`
- Manual trigger adds a one-time job without delay

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PORT` | 4002 | Server port |
| `MONGO_URI` | `mongodb://localhost:27017/atlas-scheduler` | MongoDB |
| `KEYCLOAK_ISSUER` | `http://localhost:8080/realms/atlas` | Keycloak |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed origin |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | 6379 | Redis port |

## Docker (Production)

Traefik route: `Host(xaverric.cz) && PathPrefix(/api/v1/scheduler)`
