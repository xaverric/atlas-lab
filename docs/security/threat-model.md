# Threat Model

## System Overview

Atlas Lab is a monorepo containing 6 backend microservices, 1 MCP proxy server, and 1 Next.js frontend, deployed as Docker containers behind a Traefik reverse proxy. Authentication is handled by Keycloak (OIDC).

## Trust Boundaries

```
Internet
  │
  ├── Traefik (TLS termination, rate limiting, subdomain routing)
  │     │
  │     ├── Public zone
  │     │     ├── atlas-gui (Next.js, port 3000)
  │     │     ├── atlas-mcp (MCP server, port 4005)
  │     │     └── Keycloak (auth, port 8080)
  │     │
  │     └── Authenticated zone (JWT required)
  │           ├── atlas-core (port 4000)
  │           ├── atlas-dms (port 4001)
  │           ├── atlas-scheduler (port 4002)
  │           ├── atlas-notify (port 4003)
  │           └── atlas-notes (port 4004)
  │
  └── Internal zone (Docker network only)
        ├── MongoDB
        ├── Redis (BullMQ)
        ├── MinIO (S3)
        ├── Qdrant (vector DB)
        ├── Ollama (embeddings)
        └── PostgreSQL (Keycloak)
```

## Attack Surface

| Surface | Exposure | Protection |
| ------- | -------- | ---------- |
| GUI (xaverric.cz) | Public | Keycloak OIDC login, HTTPS via Traefik |
| MCP endpoint (/mcp) | Public | JWT passthrough, permissive CORS |
| API endpoints | Authenticated | JWT verification via Keycloak JWKS |
| DMS file downloads | Presigned URLs | Time-limited MinIO presigned URLs |
| DMS public folders | Public | Read-only, no auth required |
| Scheduler job execution | Internal | Docker sandbox (cap_drop ALL, no-new-privileges, resource limits) |
| Inter-service (scheduler→notify) | Internal | X-Internal-Key header |
| Keycloak admin | Internal | Admin credentials, not exposed publicly |
| MinIO console | Subdomain | Credentials required |

## Data Flow

```
User ──HTTPS──> Traefik ──HTTP──> GUI (Next.js)
                   │                  │
                   │            OIDC redirect
                   │                  │
                   │              Keycloak ──> PostgreSQL
                   │                  │
                   │            JWT issued
                   │                  │
                   ├──HTTP+JWT──> Backend Services ──> MongoDB
                   │                  │
                   │            atlas-dms ──> MinIO (file storage)
                   │            atlas-scheduler ──> Redis (job queues)
                   │            atlas-notify ──> Redis + SMTP/Telegram
                   │            atlas-notes ──> Ollama ──> Qdrant
                   │
                   └──HTTP+JWT──> atlas-mcp ──HTTP+JWT──> All backends
```

## STRIDE Analysis

### Spoofing

| Threat | Mitigation | Status |
| ------ | ---------- | ------ |
| JWT forgery | Keycloak JWKS endpoint verification (`createAuth` middleware) | Mitigated |
| Stolen JWT | 30-min access token expiry, silent refresh | Mitigated |
| Inter-service impersonation | X-Internal-Key shared secret | Partial — key is static |

### Tampering

| Threat | Mitigation | Status |
| ------ | ---------- | ------ |
| NoSQL injection | Zod schema validation on all inputs (`validate` middleware) | Mitigated |
| File upload manipulation | MinIO server-side validation, content-type checks | Mitigated |
| Scheduler job code injection | Docker sandbox with restricted capabilities | Mitigated |

### Repudiation

| Threat | Mitigation | Status |
| ------ | ---------- | ------ |
| Untracked actions | Pino structured logging on all services | Mitigated |
| Log tampering | Docker log driver, 90-day retention | Partial |

### Information Disclosure

| Threat | Mitigation | Status |
| ------ | ---------- | ------ |
| Stack traces in responses | `errorHandler` middleware strips details in production | Mitigated |
| MinIO file exposure | Presigned URLs with expiration | Mitigated |
| Credential leaks | `.env` files in `.gitignore`, no secrets in code | Mitigated |
| MongoDB data exposure | Docker internal network only, no public port | Mitigated |

### Denial of Service

| Threat | Mitigation | Status |
| ------ | ---------- | ------ |
| API flooding | Traefik rate limiting | Partial |
| Large file uploads | DMS file size limits | Mitigated |
| Scheduler job resource exhaustion | Docker resource limits (CPU, memory, timeout) | Mitigated |
| BullMQ queue flooding | Redis memory limits | Partial |

### Elevation of Privilege

| Threat | Mitigation | Status |
| ------ | ---------- | ------ |
| Role escalation | Keycloak RBAC (admin/user roles), `requireRole` middleware | Mitigated |
| Container escape | `cap_drop: ALL`, `no-new-privileges`, read-only rootfs | Mitigated |
| Docker socket abuse | Scheduler executor has socket access for job containers | Residual risk |

## Residual Risks

1. **Docker socket access**: The scheduler service mounts the Docker socket to spawn sandboxed job containers. A compromised scheduler could create arbitrary containers. Mitigation: restrict scheduler network access, monitor container creation.

2. **Wildcard CORS on MCP**: The MCP server allows broad CORS to support AI tool integrations. This could enable cross-origin requests from malicious sites if a user's JWT is available.

3. **Static internal API key**: The X-Internal-Key for inter-service auth is a static secret. Compromise allows impersonating internal service calls.

4. **Single-node deployment**: No redundancy. A single compromised service could affect the entire stack.

5. **Ollama model integrity**: Embedding models are pulled from public registries without signature verification.
