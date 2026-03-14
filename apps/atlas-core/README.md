# atlas-core (@atlas/server)

Core user service for the Atlas platform. Handles user profiles and preferences synced from Keycloak.

## Port: 4000

## Architecture

```
Route → Controller → Service → DAO → Model
```

## API Endpoints

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |

### Users

All user routes require Bearer token authentication.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/users/me` | Get current user profile (auto-creates on first call) |
| PATCH | `/api/v1/users/me/preferences` | Update user preferences |

### Auto-creation Flow

On first authenticated request, if no `User` document exists for the Keycloak `sub`, one is created automatically from the JWT payload:

```
JWT { sub, email, name } → userService.findOrCreateFromToken() → User document
```

## Data Model

### User

| Field | Type | Description |
|-------|------|-------------|
| keycloakId | string | Keycloak `sub` claim (unique) |
| email | string | From JWT |
| name | string | From JWT name or preferred_username |
| role | enum | `user` or `admin` |
| preferences.theme | enum | `light`, `dark`, `system` |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PORT` | 4000 | Server port |
| `MONGO_URI` | `mongodb://localhost:27017/atlas` | MongoDB connection |
| `KEYCLOAK_ISSUER` | `http://localhost:8080/realms/atlas` | Internal Keycloak URL (JWKS fetch) |
| `KEYCLOAK_PUBLIC_ISSUER` | Same as ISSUER | Public Keycloak URL (JWT `iss` validation) |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |

## Dependencies

Uses `@atlas/server-common` for auth, validation, error handling, and DB connection.

## Docker (Production)

Traefik route: `Host(xaverric.cz) && (PathPrefix(/api/v1/users) || Path(/health))`
