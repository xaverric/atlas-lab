# @atlas/core

Shared TypeScript types, error classes, validators, and constants used across all Atlas services.

## No Build Step

This package exports raw TypeScript source. Consumers resolve it via `tsconfig.json` path aliases and `transpilePackages` (Next.js). There is no `dist/` directory.

## Exports

### `ApiError`

Custom error class for structured HTTP error responses.

```ts
throw new ApiError(404, 'User not found');
throw new ApiError(400, 'Validation failed', { email: ['Invalid format'] });
```

**Properties:**
- `status: number` — HTTP status code
- `message: string` — error message
- `details?: Record<string, string[]>` — field-level validation errors

### Constants

```ts
API_VERSION  // 'v1'
API_PREFIX   // '/api/v1'

enum UserRole {
  User = 'user',
  Admin = 'admin',
}
```

### Types

| Type | Description |
|------|-------------|
| `User` | Full user record (id, keycloakId, email, name, role, preferences, timestamps) |
| `UserPreferences` | `{ theme: 'light' \| 'dark' \| 'system' }` |
| `ApiResponse<T>` | `{ data: T }` |
| `ApiErrorResponse` | `{ error: string, details?: Record<string, string[]> }` |
| `PaginatedResponse<T>` | `{ data: T[], total, page, limit }` |

### Validators (Zod)

```ts
paginationSchema  // { page: number (min 1), limit: number (min 1, max 100) }
objectIdSchema    // 24-char hex string
```

## Usage

```ts
import { ApiError, API_PREFIX, UserRole } from '@atlas/core';
import type { User, PaginatedResponse } from '@atlas/core';
```

### tsconfig.json setup

```json
{
  "compilerOptions": {
    "paths": {
      "@atlas/core": ["../../packages/core/src"]
    }
  }
}
```
