import { User, UserManager, WebStorageStateStore } from 'oidc-client-ts';

const authority = process.env.NEXT_PUBLIC_OIDC_AUTHORITY || 'http://localhost:8080/realms/atlas';
const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || 'atlas-gui';
const redirectUri = typeof window !== 'undefined'
  ? `${window.location.origin}/callback`
  : 'http://localhost:3000/callback';

let userManager: UserManager | null = null;

export const getUserManager = () => {
  if (!userManager && typeof window !== 'undefined') {
    userManager = new UserManager({
      authority,
      client_id: clientId,
      redirect_uri: redirectUri,
      post_logout_redirect_uri: typeof window !== 'undefined' ? window.location.origin : '',
      response_type: 'code',
      scope: 'openid profile email',
      automaticSilentRenew: true,
      userStore: new WebStorageStateStore({ store: window.localStorage }),
    });
  }
  if (!userManager) throw new Error('UserManager not available — ensure this is called in a browser context');
  return userManager;
};

export async function loginWithCredentials(username: string, password: string): Promise<User> {
  const tokenUrl = `${authority}/protocol/openid-connect/token`;

  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    username,
    password,
    scope: 'openid profile email',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.error || 'Authentication failed');
  }

  const tokens = await res.json();

  const um = getUserManager();
  const user = new User({
    access_token: tokens.access_token,
    token_type: tokens.token_type || 'Bearer',
    id_token: tokens.id_token,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope || 'openid profile email',
    profile: parseJwtPayload(tokens.id_token) as any,
    expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
  });

  await um.storeUser(user);
  return user;
}

function parseJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}
