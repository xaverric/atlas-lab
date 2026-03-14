# @atlas/server-common

Shared Express middleware and utilities for all Atlas backend services. Extracted from `atlas-core` to avoid code duplication across services.

## No Build Step

Like `@atlas/core`, this package exports raw TypeScript. Resolve via tsconfig `paths`.

## Exports

### `createAuth(options) => RequestHandler`

Creates a JWT verification middleware that validates Keycloak access tokens.

```ts
import { createAuth } from '@atlas/server-common';

const auth = createAuth({
  issuer: 'http://keycloak:8080/realms/atlas',      // internal URL for JWKS fetch
  publicIssuer: 'http://localhost:8080/realms/atlas', // public URL for `iss` claim validation
});

router.use(auth);
// req.auth is now available with: sub, email, name, preferred_username, realm_access.roles
```

**`AuthPayload` interface:**
```ts
interface AuthPayload extends JWTPayload {
  sub: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  realm_access?: { roles: string[] };
}
```

Augments `Express.Request` globally with `req.auth: AuthPayload`.

### `requireRole(...roles) => RequestHandler`

Role-based access control middleware. Must be used after `auth`.

```ts
router.delete('/users/:id', auth, requireRole('admin'), controller.deleteUser);
```

Checks `req.auth.realm_access.roles` for any matching role. Returns `403 Insufficient permissions` if none match.

### `validate(schema, source?) => RequestHandler`

Zod schema validation middleware.

```ts
import { z } from 'zod';
import { validate } from '@atlas/server-common';

const createSchema = z.object({ name: z.string().min(1), email: z.string().email() });
router.post('/', validate(createSchema), controller.create);
router.get('/', validate(querySchema, 'query'), controller.list);
```

- `source`: `'body'` (default), `'query'`, or `'params'`
- On invalid input: `400 Validation failed` with `details: { field: ['message'] }`

### `errorHandler: ErrorRequestHandler`

Centralized error handler. Mount as last middleware.

```ts
app.use(errorHandler);
```

- `ApiError` instances → structured JSON with status code
- All other errors → `500 Internal server error` + console.error

### `connectDB(uri: string) => Promise<void>`

Connects Mongoose to MongoDB.

```ts
import { connectDB } from '@atlas/server-common';

await connectDB('mongodb://localhost:27017/my-service');
```

Exits process with code 1 on connection failure.

### `createLogger(name: string) => pino.Logger`

Creates a structured logger (pino) with pretty-printing in development.

```ts
import { createLogger } from '@atlas/server-common';

const log = createLogger('atlas-dms');
log.info({ documentId }, 'Document uploaded');
```

- Uses `pino-pretty` when `NODE_ENV !== 'production'`
- Log level configurable via `LOG_LEVEL` env var (default: `info`)

## Dependencies

| Package | Purpose |
|---------|---------|
| `jose` | JWT verification against Keycloak JWKS |
| `zod` | Request validation |
| `mongoose` | MongoDB connection |
| `pino` / `pino-pretty` | Structured logging |

`express` is a peer dependency — consumers must install it themselves.
