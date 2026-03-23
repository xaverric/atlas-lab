# Secrets Rotation Policy

## Secret Inventory

| Secret | Configured in | Used by | Rotation method |
| ------ | ------------- | ------- | --------------- |
| `KEYCLOAK_ADMIN_PASSWORD` | `.env` | Keycloak | Update `.env`, restart Keycloak, update via admin console |
| `MONGODB_PASSWORD` | `.env` | MongoDB, all backend services | Update `.env`, restart MongoDB + all backends |
| `REDIS_PASSWORD` | `.env` | Redis, scheduler, notify | Update `.env`, restart Redis + scheduler + notify |
| `POSTGRES_PASSWORD` | `.env` | PostgreSQL, Keycloak | Update `.env`, restart PostgreSQL + Keycloak |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | `.env` | MinIO, DMS | Update `.env`, restart MinIO + DMS |
| `SMTP_USER` / `SMTP_PASS` | `.env` | Notify | Update `.env`, restart notify |
| `TELEGRAM_BOT_TOKEN` | `.env` | Notify | Regenerate via @BotFather, update `.env`, restart notify |
| `INTERNAL_API_KEY` | `.env` | Scheduler, notify (X-Internal-Key) | Update `.env`, restart scheduler + notify |
| `DOCKER_HUB_TOKEN` | GitHub Secrets | CI/CD (GitHub Actions) | Regenerate on Docker Hub, update GitHub repo secret |
| VPS SSH key | GitHub Secrets | CI/CD deployment | Generate new keypair, update VPS `authorized_keys` + GitHub secret |
| Keycloak client secret | Keycloak admin console | GUI (OIDC client) | Regenerate in Keycloak, update GUI env config |

## Rotation Procedures

### Database credentials (MongoDB, PostgreSQL, Redis)

```bash
# 1. Generate new password
NEW_PASS=$(openssl rand -base64 32)

# 2. Update .env file with new password

# 3. Restart database and all dependent services
docker compose up -d <database> <dependent-services>
```

**MongoDB** affects: atlas-core, atlas-dms, atlas-scheduler, atlas-notify, atlas-notes
**PostgreSQL** affects: Keycloak only
**Redis** affects: atlas-scheduler, atlas-notify

### MinIO credentials

```bash
# 1. Update MINIO_ROOT_USER and MINIO_ROOT_PASSWORD in .env
# 2. Restart MinIO and DMS
docker compose up -d minio atlas-dms
# Note: existing buckets and data persist through credential rotation
```

### Internal API key

```bash
# 1. Generate new key
NEW_KEY=$(openssl rand -hex 32)

# 2. Update INTERNAL_API_KEY in .env
# 3. Restart both services that use it
docker compose up -d atlas-scheduler atlas-notify
```

### Telegram bot token

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Use `/revoke` to invalidate the old token
3. Use the new token, update `TELEGRAM_BOT_TOKEN` in `.env`
4. Restart: `docker compose up -d atlas-notify`

### CI/CD secrets (GitHub)

1. Go to repository Settings > Secrets and variables > Actions
2. Update the secret value
3. Re-run the latest workflow to verify

## Rotation Schedule

| Category | Frequency | Notes |
| -------- | --------- | ----- |
| Service account passwords | 90 days | MongoDB, Redis, PostgreSQL, MinIO |
| API keys and tokens | 90 days | Internal API key, Docker Hub token |
| Telegram bot token | On compromise only | Low risk, difficult to exploit |
| SSH keys | 180 days | Or immediately on personnel change |
| Keycloak admin | 90 days | |
| **Any secret** | **Immediately** | **On suspected compromise** |

## Automation

Currently all rotation is manual. For a production setup, consider:

- **HashiCorp Vault**: Centralized secret management with automatic rotation
- **Docker Secrets**: Native Docker secret management instead of `.env` files
- **GitHub Actions OIDC**: Replace long-lived tokens with short-lived OIDC credentials for CI/CD
