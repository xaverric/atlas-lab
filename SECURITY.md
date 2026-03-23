# Security Policy

## Supported Versions

Atlas Lab is a personal development/lab project in active development. There are no stable releases yet.

| Version | Supported |
| ------- | --------- |
| 0.x (main branch) | Yes — latest commit on `main` |
| Older commits | No |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Email**: Send details to the repository owner via GitHub ([@xaverric](https://github.com/xaverric))
2. **Do not** open a public GitHub issue for security vulnerabilities
3. Include: description, steps to reproduce, affected component, potential impact

### Response Timeline

- **72 hours**: Acknowledgement of report
- **7 days**: Initial assessment and severity classification
- **30 days**: Fix for critical/high severity issues
- **90 days**: Fix for medium/low severity issues

## Scope

### In Scope

- All backend services (atlas-core, atlas-dms, atlas-scheduler, atlas-notify, atlas-notes, atlas-mcp)
- Frontend application (atlas-gui)
- Docker Compose configurations and Dockerfiles
- CI/CD pipeline (GitHub Actions workflows)
- Infrastructure configuration (Traefik, Keycloak realm config)

### Out of Scope

- Third-party dependencies (report upstream to the maintainer, but feel free to notify us)
- Keycloak, MongoDB, Redis, MinIO, Qdrant, Ollama core vulnerabilities (report to respective projects)
- Denial of service against development/local instances

## Disclosure Policy

This project follows **coordinated disclosure**:

1. Reporter notifies the maintainer privately
2. Maintainer acknowledges and works on a fix
3. Fix is released and deployed
4. Public disclosure after fix is available, or after 90 days (whichever comes first)

## Security Updates

- Patches are committed directly to `main` and tagged if significant
- Trivy scans run on every push (all 8 Docker images), results in GitHub Security tab
- Dependabot alerts are enabled for dependency vulnerabilities

## Known Limitations

This is a personal lab/development project. It is **not production-hardened**:

- Secrets are managed via `.env` files, not a dedicated vault
- No WAF or DDoS protection beyond Traefik rate limiting
- Single-node deployment (no HA/redundancy)
- Scheduler job execution uses Docker sandboxing but shares the Docker socket
- MCP server has permissive CORS for AI tool integration
