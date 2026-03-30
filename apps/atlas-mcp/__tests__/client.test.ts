import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRefreshAccessToken } = vi.hoisted(() => ({
  mockRefreshAccessToken: vi.fn(),
}));

vi.mock('../src/config.js', () => ({
  config: {
    services: {
      core: 'https://core.test/',
      dms: 'https://dms.test/',
      scheduler: 'https://scheduler.test/',
      notify: 'https://notify.test/',
      notes: 'https://notes.test/',
      tracker: 'https://tracker.test/',
    },
  },
}));

vi.mock('../src/session.js', () => ({
  refreshAccessToken: mockRefreshAccessToken,
}));

import { request, uploadMultipart } from '../src/client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockRefreshAccessToken.mockReset();
});

describe('client', () => {
  it('builds URLs with query params and retries after token refresh', async () => {
    mockRefreshAccessToken.mockResolvedValue('new-token');
    mockFetch
      .mockResolvedValueOnce({ status: 401 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: { ok: true } }),
      });

    const result = await request('core', {
      path: '/api/v1/users/me',
      token: 'old-token',
      sessionId: 'session-1',
      query: { page: '1', empty: '' },
    });

    expect(result).toEqual({ data: { ok: true } });
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://core.test/api/v1/users/me?page=1',
      expect.objectContaining({
        headers: { Authorization: 'Bearer old-token' },
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://core.test/api/v1/users/me?page=1',
      expect.objectContaining({
        headers: { Authorization: 'Bearer new-token' },
      }),
    );
  });

  it('returns plain text responses when JSON parsing is not applicable', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'plain-text-response',
    });

    await expect(
      request('notify', {
        path: '/health',
        token: 'token',
      }),
    ).resolves.toBe('plain-text-response');
  });

  it('throws API errors from JSON responses', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: 'Bad request' }),
    });

    await expect(
      request('notes', {
        method: 'POST',
        path: '/api/v1/notes',
        token: 'token',
        body: { title: 'Broken' },
      }),
    ).rejects.toThrow('Bad request');
  });

  it('retries multipart uploads after refreshing the session token', async () => {
    mockRefreshAccessToken.mockResolvedValue('refreshed-token');
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'expired' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { uploaded: true } }) });

    const result = await uploadMultipart('dms', {
      path: '/api/v1/files/documents',
      token: 'token',
      sessionId: 'session-1',
      filename: 'note.txt',
      mimeType: 'text/plain',
      base64Content: Buffer.from('hello').toString('base64'),
      fields: { folderId: 'folder-1' },
    });

    expect(result).toEqual({ data: { uploaded: true } });
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://dms.test/api/v1/files/documents',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer refreshed-token' },
      }),
    );
  });
});
