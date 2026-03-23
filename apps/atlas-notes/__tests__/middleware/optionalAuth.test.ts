import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockJwtVerify = vi.fn();

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn().mockReturnValue('mock-jwks'),
  jwtVerify: (...args: unknown[]) => mockJwtVerify(...args),
}));

vi.mock('../../src/config/index.js', () => ({
  config: {
    keycloak: {
      issuer: 'http://localhost:8080/realms/atlas',
      publicIssuer: 'http://localhost:8080/realms/atlas',
    },
  },
}));

import { optionalAuth } from '../../src/middleware/optionalAuth.js';

describe('optionalAuth', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const mockReq = (authHeader?: string) => ({
    headers: { authorization: authHeader },
    auth: undefined as any,
  });

  const mockRes = {} as any;

  it('attaches auth when valid Bearer token provided', async () => {
    const payload = { sub: 'user-1', email: 'test@test.com' };
    mockJwtVerify.mockResolvedValue({ payload });

    const req = mockReq('Bearer valid-token');
    const next = vi.fn();

    await optionalAuth(req as any, mockRes, next);

    expect(req.auth).toBe(payload);
    expect(next).toHaveBeenCalled();
  });

  it('calls next without auth when no header', async () => {
    const req = mockReq();
    const next = vi.fn();

    await optionalAuth(req as any, mockRes, next);

    expect(req.auth).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('calls next without auth when header is not Bearer', async () => {
    const req = mockReq('Basic abc123');
    const next = vi.fn();

    await optionalAuth(req as any, mockRes, next);

    expect(req.auth).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('calls next without auth when token is invalid', async () => {
    mockJwtVerify.mockRejectedValue(new Error('Invalid token'));

    const req = mockReq('Bearer bad-token');
    const next = vi.fn();

    await optionalAuth(req as any, mockRes, next);

    expect(req.auth).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('does not attach auth when payload has no sub', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { email: 'test@test.com' } });

    const req = mockReq('Bearer no-sub-token');
    const next = vi.fn();

    await optionalAuth(req as any, mockRes, next);

    expect(req.auth).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
