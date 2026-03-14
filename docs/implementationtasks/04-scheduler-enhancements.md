# 04 — Scheduler Enhancements

## Current State

- Job scheduling with cron/interval/once trigger types
- Executors: `webhook`, `shell`, `javascript`
- BullMQ for async job processing via Redis
- Models: `Job` (name, type, schedule, executor config, hooks), `JobRun` (jobId, status, output, duration), `JobStorage` (per-job key-value)
- Notification hooks: job success/failure → POST to atlas-notify via `X-Internal-Key`
- GUI: job list, job form, cron builder, run history, code editor

## Goals

### 1. Git Executor Type

**Business case:** Execute git operations as scheduled jobs — automated pulls, pushes, backups, repo syncing. SSH key support for private repos.

**Requirements:**
- New executor type: `git`
- Operations: `clone`, `pull`, `push`, `sync` (pull + push)
- SSH private key configuration (stored securely per job)
- Working directory management (clone to temp or persistent path)
- Output: git command output, diff summary, commit log

**New executor:**

`apps/atlas-scheduler/src/executors/git.ts`:
```
interface GitExecutorConfig {
  operation: 'clone' | 'pull' | 'push' | 'sync';
  repoUrl: string;          // git@github.com:user/repo.git or https://...
  branch?: string;           // default: main
  sshPrivateKey?: string;    // stored encrypted or via reference
  workDir?: string;          // persistent working directory
  commitMessage?: string;    // for push operations
  remote?: string;           // default: origin
}
```

**Implementation:**
- Use `child_process.execFile` to run git commands
- For SSH: write temp SSH key file, set `GIT_SSH_COMMAND` env var
- Clean up temp key after execution
- For clone: check if workDir exists, skip clone if already present (do pull instead)
- Capture stdout/stderr for run output

**Security considerations:**
- SSH private keys should be stored encrypted in JobStorage (not in Job config directly)
- Use `JobStorage` model to store sensitive config: `await jobStorageDao.set(jobId, 'sshKey', encryptedKey)`
- Decrypt at execution time only
- Consider: environment variable for encryption key
- Never log SSH key contents

**Files to create/modify:**
- Create: `apps/atlas-scheduler/src/executors/git.ts`
- Modify: `apps/atlas-scheduler/src/executors/index.ts` — register git executor
- Modify: `apps/atlas-scheduler/src/executors/types.ts` — add GitExecutorConfig to union
- Modify: `apps/atlas-scheduler/src/models/Job.ts` — add 'git' to executor enum

**GUI additions:**

`apps/atlas-gui/src/components/scheduler/`:
- Git executor form: repo URL, branch, operation select, SSH key textarea (masked)
- SSH key management: upload or paste, stored via API
- Operation-specific options (commit message for push, etc.)

**API for SSH key storage:**
```
PUT  /api/v1/scheduler/jobs/:id/secrets   — store encrypted secrets (SSH key)
GET  /api/v1/scheduler/jobs/:id/secrets   — list secret keys (not values)
```

### 2. n8n Integration

**Business case:** Deploy own n8n instance with AI module for complex workflow automation — data gathering, statistics processing, multi-step pipelines that go beyond simple cron jobs.

**Requirements:**
- Deploy n8n as Docker service in the atlas stack
- n8n AI module enabled (for AI-powered workflow steps)
- Integration with atlas services (n8n can call atlas APIs)
- Accessible via subdomain: `n8n.xaverric.cz`

**Infrastructure:**

`deployment/docker-compose.yml` — add n8n service:
```yaml
n8n:
  image: n8nio/n8n:latest
  environment:
    - N8N_BASIC_AUTH_ACTIVE=true
    - N8N_BASIC_AUTH_USER=${N8N_USER}
    - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
    - N8N_HOST=n8n.${ATLAS_DOMAIN}
    - N8N_PROTOCOL=https
    - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
    - EXECUTIONS_MODE=queue
    - QUEUE_BULL_REDIS_HOST=redis
    - DB_TYPE=postgresdb  # or sqlite for simplicity
    - DB_POSTGRESDB_HOST=...
  volumes:
    - n8n_data:/home/node/.n8n
  labels:
    - traefik.enable=true
    - traefik.http.routers.n8n.rule=Host(`n8n.${ATLAS_DOMAIN}`)
    - traefik.http.services.n8n.loadbalancer.server.port=5678
```

**n8n AI Module setup:**
- Enable `@n8n/n8n-nodes-langchain` community node
- Configure Ollama connection (reuse existing atlas Ollama instance)
- Or configure external AI provider (OpenAI/Anthropic API key)

**Integration points:**

1. **n8n → atlas APIs:** n8n HTTP Request nodes call atlas services with service account JWT or internal key
2. **atlas-scheduler → n8n:** New executor type `n8n` that triggers n8n workflows via webhook
3. **n8n → atlas-notify:** n8n can send notifications through atlas notification system

**New executor (optional):**

`apps/atlas-scheduler/src/executors/n8n.ts`:
```
interface N8nExecutorConfig {
  webhookUrl: string;    // n8n webhook trigger URL
  payload?: object;      // data to send
  waitForCompletion?: boolean;
}
```

**Deployment additions:**
- `deployment/.env.example` — add N8N_USER, N8N_PASSWORD, N8N_ENCRYPTION_KEY
- `deployment/docker-compose.yml` — add n8n service
- `deployment/traefik/traefik.yml` — n8n routing (handled by labels)

**GUI:**
- Add n8n link in sidebar under "Tools" or "Integrations" section
- Opens n8n in new tab or iframe (n8n has its own UI)

## Implementation Order

1. **Git executor** — self-contained, no infrastructure changes
2. **n8n deployment** — infrastructure + Docker compose
3. **n8n integration** — optional n8n executor type in scheduler

## Dependencies

- Git executor: none, can be done independently
- n8n: needs Docker compose changes, possibly PostgreSQL if not using SQLite
- n8n AI module: needs Ollama or external AI API key
- n8n reuses Redis — verify no port/namespace conflicts with BullMQ
