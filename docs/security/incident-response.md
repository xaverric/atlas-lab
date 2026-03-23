# Incident Response Playbook

## Severity Levels

| Level | Description | Response Time | Example |
| ----- | ----------- | ------------- | ------- |
| P1 — Critical | Active exploitation, data breach | Immediate | Unauthorized DB access, container escape |
| P2 — High | Exploitable vulnerability, no active exploitation | 24 hours | JWT bypass, SQL/NoSQL injection |
| P3 — Medium | Vulnerability requiring specific conditions | 7 days | CSRF, information disclosure via error messages |
| P4 — Low | Hardening improvement, no direct exploit | 30 days | Missing headers, verbose logging |

## Response Steps

### 1. Detect

- Monitor Traefik access logs for anomalies: `docker logs atlas-traefik --since 1h`
- Check GitHub Security tab for Trivy alerts
- Review service logs: `docker logs atlas-<service> --since 1h`
- Check BullMQ failed jobs: `docker exec atlas-redis redis-cli LLEN bull:<queue>:failed`

### 2. Contain

Isolate the affected service immediately:

```bash
# Stop a specific service
docker stop atlas-<service>

# Block external access while keeping internal network
# Add to Traefik: remove the service's router labels

# If full isolation needed (P1)
docker network disconnect atlas-lab_default atlas-<service>
```

Service-specific isolation:

| Service | Stop command | Side effects |
| ------- | ------------ | ------------ |
| atlas-core | `docker stop atlas-core` | User management unavailable |
| atlas-dms | `docker stop atlas-dms` | File access unavailable |
| atlas-scheduler | `docker stop atlas-scheduler` | Jobs stop executing |
| atlas-notify | `docker stop atlas-notify` | Notifications queue but don't send |
| atlas-notes | `docker stop atlas-notes` | Notes/search unavailable |
| atlas-mcp | `docker stop atlas-mcp` | AI tool access unavailable |
| atlas-gui | `docker stop atlas-gui` | Frontend unavailable, APIs still accessible |

### 3. Investigate

```bash
# Service logs (structured JSON via pino)
docker logs atlas-<service> --since 24h 2>&1 | jq '.msg, .err'

# Traefik access logs
docker logs atlas-traefik --since 24h 2>&1 | grep '<suspicious-ip>'

# MongoDB — check for unusual operations
docker exec atlas-mongodb mongosh --eval '
  db.getSiblingDB("admin").currentOp()
'

# MongoDB — audit recent document changes
docker exec atlas-mongodb mongosh atlas-<db> --eval '
  db.<collection>.find({ updatedAt: { $gte: new Date(Date.now() - 86400000) } }).sort({ updatedAt: -1 }).limit(20)
'

# Redis — check queue state
docker exec atlas-redis redis-cli KEYS 'bull:*'

# Check running containers for unexpected processes
docker top atlas-<service>

# Inspect container for modifications
docker diff atlas-<service>
```

### 4. Remediate

**Credential compromise:**
```bash
# Rotate the compromised secret in .env
# Restart affected services
docker compose up -d <service>

# If Keycloak credentials compromised
# Reset via Keycloak admin console, then restart all backend services
```

**Container compromise:**
```bash
# Remove and recreate from clean image
docker stop atlas-<service>
docker rm atlas-<service>
docker compose up -d <service>
```

**Data breach:**
```bash
# Export affected data for analysis
docker exec atlas-mongodb mongosh atlas-<db> --eval '
  db.<collection>.find({}).toArray()
' > /tmp/evidence-$(date +%s).json

# Rotate all secrets (see docs/security/secrets-rotation.md)
```

### 5. Review

After resolution:

1. **Document**: Write a brief incident report — what happened, timeline, root cause, fix applied
2. **Update threat model**: Add the attack vector to `docs/security/threat-model.md` if not already covered
3. **Add regression test**: Write a test that would catch the vulnerability
4. **Rotate credentials**: If any secrets were potentially exposed
5. **Notify**: If user data was affected, notify impacted users with details and remediation steps
6. **CI/CD check**: Verify Trivy scans pass after the fix

## Contact

- Repository owner: [@xaverric](https://github.com/xaverric)
- Security reports: See [SECURITY.md](/SECURITY.md)
