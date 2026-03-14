# MCP OAuth Flow Fix

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the MCP server OAuth flow so Claude Code can authenticate via Keycloak SSO and use MCP tools.

**Architecture:** MCP server acts as OAuth AS proxy — serves metadata + fake registration returning hardcoded `atlas-mcp` client_id, proxies `/oauth/token` to Keycloak. The token proxy currently returns 502 (error swallowed in catch block). Fix: use Keycloak's internal URL for server-to-server token exchange, add error logging, handle both form-encoded and JSON token requests.

**Tech Stack:** Express, Node 22 native fetch, Keycloak OIDC

---

## Chunk 1: Fix Token Proxy

### Task 1: Add error logging and fix token proxy

**Files:**
- Modify: `apps/atlas-mcp/src/index.ts:114-131` — `/oauth/token` handler

The token proxy catches fetch errors but swallows them silently. Root causes to fix:

1. **Wrong Keycloak URL for server-side calls**: `kcOidc` uses `publicIssuer` (e.g. `http://localhost:8080` or `https://auth.xaverric.cz`). For the server-to-server token exchange, we MUST use the internal `issuer` URL (in Docker: `http://keycloak:8080`). The public URL might not resolve from the server container.

2. **Silent error swallowing**: The catch block returns generic 502 without logging the actual error. Claude Code has no idea what went wrong.

3. **Body parsing edge case**: Claude Code might send the token request with an unexpected Content-Type. The handler should handle raw body as fallback.

- [ ] **Step 1: Fix the `/oauth/token` handler**

Replace the current handler in `apps/atlas-mcp/src/index.ts`:

```typescript
app.post('/oauth/token', async (req, res) => {
  // Use INTERNAL issuer for server-to-server Keycloak calls
  const kcTokenUrl = `${config.keycloak.issuer}/protocol/openid-connect/token`;

  let params: URLSearchParams;
  if (typeof req.body === 'string') {
    params = new URLSearchParams(req.body);
  } else if (req.body && typeof req.body === 'object') {
    params = new URLSearchParams(req.body as Record<string, string>);
  } else {
    res.status(400).json({ error: 'Missing request body' });
    return;
  }

  if (!params.has('client_id')) {
    params.set('client_id', config.keycloak.clientId);
  }

  try {
    const kcRes = await fetch(kcTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await kcRes.text();
    res.status(kcRes.status).set('Content-Type', 'application/json').send(data);
  } catch (err) {
    console.error('Token proxy error:', err);
    res.status(502).json({ error: 'Token exchange failed', detail: String(err) });
  }
});
```

- [ ] **Step 2: Add `express.text()` middleware for raw body fallback**

Add to the middleware chain (after `express.urlencoded`):

```typescript
app.use(express.text({ type: 'application/x-www-form-urlencoded' }));
```

Wait — this conflicts with `express.urlencoded`. Instead, just ensure the urlencoded middleware is active (it already is). The real fix is using the internal Keycloak URL.

- [ ] **Step 3: Restart MCP server and test token proxy**

Run: `curl -s -X POST http://localhost:4005/oauth/token -H 'Content-Type: application/x-www-form-urlencoded' -d 'grant_type=authorization_code&code=fake&client_id=atlas-mcp&redirect_uri=http://localhost:1234&code_verifier=test'`

Expected: `{"error":"invalid_grant","error_description":"Code not valid"}` (Keycloak error, NOT 502)

- [ ] **Step 4: Commit**

```bash
git add apps/atlas-mcp/src/index.ts
git commit -m "fix(mcp): use internal Keycloak URL for token proxy, add error logging"
```

### Task 2: Verify full OAuth flow with Claude Code

- [ ] **Step 1: Restart MCP server**

Run: `npm run dev:mcp` (or let tsx watch reload)

- [ ] **Step 2: Restart Claude Code and test `/mcp`**

1. Exit Claude Code
2. Start Claude Code
3. Run `/mcp`
4. Select atlas → Authenticate
5. Browser opens Keycloak login
6. Log in
7. Claude Code should show atlas as connected

- [ ] **Step 3: Test a tool call**

Ask Claude Code to use `health_check` tool. Expect: list of backend service statuses.

---

## Chunk 2: Keycloak Login Page (Atlas-themed)

### Task 3: Assess login page situation

The Atlas GUI login page (`apps/atlas-gui/src/app/login/page.tsx`) uses **direct grant** (username/password → Keycloak token endpoint). This is NOT compatible with OAuth authorization code flow.

For the MCP OAuth flow, Claude Code must redirect to Keycloak's `/auth` endpoint. This shows Keycloak's built-in login page. This is correct behavior — it's the same page any OIDC client sees.

**Options:**
1. **Keycloak theme** — customize Keycloak's login page to match Atlas branding (recommended, separate task)
2. **No-op** — Keycloak's default login page works fine for SSO

- [ ] **Step 1: Decide approach**

This is a cosmetic/UX task, not a functional one. The OAuth flow works with Keycloak's default login page. Keycloak theming is a separate initiative. Skip for now — the MCP auth flow is functional.

- [ ] **Step 2: Document as future improvement**

Add a note: Keycloak theme customization for Atlas branding is a nice-to-have but not blocking MCP functionality.
