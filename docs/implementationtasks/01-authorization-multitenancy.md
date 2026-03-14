# 01 — Authorization & Multi-Tenancy

## Current State

- Keycloak handles all authentication (OIDC flow, JWT tokens)
- `createAuth()` middleware verifies JWT and populates `req.auth` with `sub`, `email`, `name`, `realm_access.roles`
- `requireRole()` middleware exists in `packages/server-common` for role-based route protection
- No per-user data isolation — all users see all data
- Keycloak login page is used directly (standard Keycloak theme)
- Session: 8h SSO, 30min access token refresh

## Goals

### 1. Per-User Data Isolation

Every resource in the system must be scoped to the user who created it. A `user` role user sees only their own data. An `admin` role user can optionally browse other users' data.

**Affected services and models:**

| Service | Models | Current owner field | Needed |
|---------|--------|-------------------|--------|
| atlas-notes | Note, NoteFolder | `userId` | Already has it — enforce in queries |
| atlas-dms | Document, Folder | `createdBy` | Enforce in queries |
| atlas-scheduler | Job, JobRun | `createdBy` | Enforce in queries |
| atlas-notify | Notification, NotificationPreference | `userId` | Enforce in queries |
| atlas-core | User | N/A (user is the resource) | No change needed |

**Implementation approach:**

#### A. DAO-level filtering (preferred pattern)

Every DAO method that lists or fetches resources should accept `userId` and apply it as a filter. This is cleaner than middleware because it prevents data leaks at the source.

```
// Pattern for every DAO list method:
async findAll(filters, userId, isAdmin = false) {
  const query = { ...filters };
  if (!isAdmin) {
    query.createdBy = userId;  // or query.userId = userId
  }
  return Model.find(query);
}

// Pattern for every DAO get-by-id method:
async findById(id, userId, isAdmin = false) {
  const query = { _id: id };
  if (!isAdmin) {
    query.createdBy = userId;
  }
  return Model.findOne(query);
}
```

#### B. Service-level enforcement

Services extract `userId` and `isAdmin` from the controller (which gets it from `req.auth`), pass it down to DAOs.

```
// Controller pattern:
const userId = req.auth.sub;
const isAdmin = req.auth.realm_access?.roles?.includes('admin');
const result = await service.list(filters, userId, isAdmin);
```

#### C. Files to modify per service

**atlas-notes** (`apps/atlas-notes/src/`):
- `daos/noteDao.ts` — add userId filter to `findAll`, `findById`, `findByFolder`
- `daos/noteFolderDao.ts` — add userId filter to `findAll`, `findById`, `findByParent`
- `services/noteService.ts` — pass userId/isAdmin from controller
- `services/noteFolderService.ts` — pass userId/isAdmin
- `controllers/noteController.ts` — extract auth info, pass to service
- `controllers/noteFolderController.ts` — extract auth info

**atlas-dms** (`apps/atlas-dms/src/`):
- `daos/documentDao.ts` — add createdBy filter
- `daos/folderDao.ts` — add createdBy filter
- `services/documentService.ts` — pass user context
- `services/folderService.ts` — pass user context
- `controllers/documentController.ts` — extract auth, pass down
- `controllers/folderController.ts` — extract auth, pass down

**atlas-scheduler** (`apps/atlas-scheduler/src/`):
- `daos/jobDao.ts` — add createdBy filter
- `daos/jobRunDao.ts` — add createdBy filter (runs belong to jobs, filter by job ownership)
- `services/jobService.ts` — pass user context
- `services/runService.ts` — pass user context
- `controllers/jobController.ts` — extract auth
- `controllers/runController.ts` — extract auth

**atlas-notify** (`apps/atlas-notify/src/`):
- `daos/notificationDao.ts` — add userId filter
- `daos/preferenceDao.ts` — add userId filter
- `services/notifyService.ts` — pass user context
- `services/preferenceService.ts` — pass user context
- `controllers/notifyController.ts` — extract auth
- `controllers/preferenceController.ts` — extract auth

### 2. Admin Browsing

Admin users can view other users' resources. Implementation:

- Add `?userId=<sub>` query parameter to list endpoints
- When admin provides `userId` param, use that instead of their own `sub`
- Non-admin users attempting `?userId=` different from their own → 403

**New admin-only endpoints (atlas-core):**
```
GET /api/v1/users                    — list all users (admin only)
GET /api/v1/users/:userId/notes      — proxy: list user's notes
GET /api/v1/users/:userId/documents  — proxy: list user's documents
GET /api/v1/users/:userId/jobs       — proxy: list user's jobs
```

Or simpler: each service supports `?userId=` query param, admin-gated at controller level.

### 3. Custom Login Page (Bypass Keycloak UI)

Replace Keycloak's themed login page with a custom login page built into atlas-gui, while keeping Keycloak as the OIDC backend.

**Two approaches:**

#### Approach A: Direct Grant (Resource Owner Password Credentials) — Simpler but less secure
- Build login form in `apps/atlas-gui/src/app/login/page.tsx`
- POST username/password directly to Keycloak token endpoint
- Get tokens back, store in oidc-client-ts UserManager
- Downside: exposes password to frontend, doesn't support MFA flows natively

#### Approach B: Custom Keycloak Theme — Recommended
- Create custom Keycloak theme matching atlas-gui design
- Deploy theme via Docker volume mount into Keycloak container
- Keycloak still handles the login flow (MFA-compatible, secure)
- Theme location: `deployment/keycloak/themes/atlas/login/`
- Files: `template.ftl`, `login.ftl`, CSS, images
- Reference in `atlas-realm.json`: set `loginTheme: "atlas"`

#### Approach C: Hybrid — Frontend login page, redirect to Keycloak with `kc_action`
- Custom login form submits to Keycloak REST API
- Handle OIDC code flow programmatically
- More control, but complex

**Recommended: Approach B** — custom Keycloak theme. Keeps security model intact, supports MFA, just changes the visual appearance.

**Files to create/modify:**
```
deployment/keycloak/themes/atlas/login/
  theme.properties
  template.ftl
  login.ftl
  resources/css/atlas-login.css
  resources/img/logo.svg
deployment/keycloak/atlas-realm.json  — add loginTheme
deployment/docker-compose.yml         — mount theme volume
```

**Design requirements:**
- Match atlas-gui color scheme and typography
- Show atlas logo
- Clean, minimal form (username, password, remember me, submit)
- Error messages styled consistently
- Responsive for mobile

### 4. Role Management

**Current Keycloak roles:** Likely `user` and `admin` in realm roles.

**Ensure in `atlas-realm.json`:**
- Role `user` — default for all new users
- Role `admin` — full access, can browse all users' data
- Consider: `viewer` role for read-only access (future)

**Backend enforcement pattern:**
```
// Public health endpoints — no auth
router.get('/health', healthHandler);

// Standard user endpoints — auth required
router.use(createAuth());

// Admin-only endpoints
router.get('/admin/users', requireRole('admin'), adminController.listUsers);
```

## Implementation Order

1. **DAO-level filtering** — go service by service, add userId/createdBy filters
2. **Controller/service wiring** — pass auth context through the stack
3. **Admin browsing** — add `?userId=` support gated by role check
4. **Custom Keycloak theme** — design and deploy
5. **Test isolation** — verify user A cannot see user B's data

## Dependencies

- No external dependencies — all within existing Keycloak + service code
- Custom theme requires Keycloak restart after deployment
- Frontend changes minimal — login page already exists, just needs theme
