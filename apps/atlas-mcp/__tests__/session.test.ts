import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config.js', () => ({
  config: {
    keycloak: {
      issuer: 'https://kc.test/realms/atlas',
      clientId: 'atlas-mcp',
    },
  },
}));

import { getAuth, getToken, refreshAccessToken, removeSession, sessionTokens, setToken } from '../src/session.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  sessionTokens.clear();
  mockFetch.mockReset();
});

describe('session', () => {
  it('stores and reads session auth', () => {
    setToken('session-1', 'access-token', 'refresh-token');

    expect(getToken({ sessionId: 'session-1' })).toBe('access-token');
    expect(getAuth({ sessionId: 'session-1' })).toEqual({
      token: 'access-token',
      sessionId: 'session-1',
    });
  });

  it('preserves refresh token when access token is rotated without a new refresh token', () => {
    setToken('session-1', 'access-token', 'refresh-token');
    setToken('session-1', 'new-access-token');

    expect(sessionTokens.get('session-1')).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('removes session auth', () => {
    setToken('session-1', 'access-token', 'refresh-token');
    removeSession('session-1');

    expect(() => getToken({ sessionId: 'session-1' })).toThrow('No auth token for session');
  });

  it('refreshes access token and updates stored auth', async () => {
    setToken('session-1', 'old-access-token', 'refresh-token');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      }),
    });

    const token = await refreshAccessToken('session-1');

    expect(token).toBe('new-access-token');
    expect(sessionTokens.get('session-1')).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://kc.test/realms/atlas/protocol/openid-connect/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );
  });

  it('returns null when refresh is not possible', async () => {
    expect(await refreshAccessToken('missing-session')).toBeNull();

    setToken('session-1', 'access-token', 'refresh-token');
    mockFetch.mockResolvedValue({ ok: false });

    expect(await refreshAccessToken('session-1')).toBeNull();
  });
});
