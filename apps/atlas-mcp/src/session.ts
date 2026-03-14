import { config } from './config.js';

interface SessionAuth {
  accessToken: string;
  refreshToken?: string;
}

export const sessionTokens = new Map<string, SessionAuth>();

export const getToken = (extra: { sessionId?: string }): string => {
  const id = extra.sessionId;
  if (!id) throw new Error('No session ID');
  const auth = sessionTokens.get(id);
  if (!auth) throw new Error('No auth token for session — send Authorization header');
  return auth.accessToken;
};

export const getAuth = (extra: { sessionId?: string }): { token: string; sessionId: string } => {
  const id = extra.sessionId;
  if (!id) throw new Error('No session ID');
  const auth = sessionTokens.get(id);
  if (!auth) throw new Error('No auth token for session — send Authorization header');
  return { token: auth.accessToken, sessionId: id };
};

export const setToken = (sessionId: string, accessToken: string, refreshToken?: string) => {
  const existing = sessionTokens.get(sessionId);
  sessionTokens.set(sessionId, {
    accessToken,
    refreshToken: refreshToken || existing?.refreshToken,
  });
};

export const removeSession = (sessionId: string) => {
  sessionTokens.delete(sessionId);
};

export const refreshAccessToken = async (sessionId: string): Promise<string | null> => {
  const auth = sessionTokens.get(sessionId);
  if (!auth?.refreshToken) return null;

  const tokenUrl = `${config.keycloak.issuer}/protocol/openid-connect/token`;
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken,
    client_id: config.keycloak.clientId,
  });

  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) return null;

    const data = await res.json() as { access_token: string; refresh_token?: string };
    setToken(sessionId, data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
};
