# Let's Encrypt / HTTPS Setup

## Prerequisites

- Debian VPS with Docker + Docker Compose
- Domain pointing to VPS IP (A record)
- Ports 80 and 443 open

## Steps

1. **DNS** - Point A records to VPS IP:
   - `xaverric.cz` -> VPS IP
   - `auth.xaverric.cz` -> VPS IP

2. **Update Traefik config** (`deployment/traefik/traefik.yml`):
   - Set `acme.email` to your real email

3. **Create `.env`** from `.env.example`:
   ```bash
   cd /opt/atlas/deployment
   cp .env.example .env
   # Edit with real values
   ```

4. **Start services**:
   ```bash
   docker compose up -d
   ```

5. Traefik auto-requests and renews certificates via HTTP challenge. No manual cert management needed.

6. **Keycloak** - `KC_HOSTNAME` must match the public HTTPS URL for OIDC discovery to work.

7. **Verify** - Visit `https://xaverric.cz` and `https://auth.xaverric.cz`.
