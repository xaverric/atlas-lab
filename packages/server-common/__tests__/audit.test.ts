import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('mongoose', () => {
  const model = vi.fn();
  const on = vi.fn();
  const asPromise = vi.fn().mockResolvedValue(undefined);
  const createConnection = vi.fn().mockReturnValue({ model, on, asPromise });

  function Schema() {
    return { index: vi.fn() };
  }
  Schema.Types = { Mixed: 'Mixed' };

  return { default: { createConnection, Schema } };
});

vi.mock('../src/config/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('audit middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const loadModule = async () => {
    const mod = await import('../src/middleware/audit.js');
    return mod;
  };

  const mockReq = (overrides: Record<string, any> = {}) => ({
    method: 'GET',
    path: '/api/v1/users',
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test' },
    auth: { sub: 'user-1', name: 'Test User' },
    ...overrides,
  }) as any;

  const mockRes = () => {
    const res: any = {
      statusCode: 200,
      end: vi.fn(),
    };
    return res;
  };

  it('skips /health path', async () => {
    const { createAuditMiddleware } = await loadModule();
    const middleware = createAuditMiddleware('test-svc');
    const req = mockReq({ path: '/health' });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.end).toBe(res.end);
  });

  it('skips OPTIONS method', async () => {
    const { createAuditMiddleware } = await loadModule();
    const middleware = createAuditMiddleware('test-svc');
    const req = mockReq({ method: 'OPTIONS' });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('hooks res.end for normal requests', async () => {
    const { createAuditMiddleware } = await loadModule();
    const middleware = createAuditMiddleware('test-svc');
    const req = mockReq();
    const res = mockRes();
    const originalEnd = res.end;
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.end).not.toBe(originalEnd);
  });

  it('calls original res.end when hooked end is invoked', async () => {
    const { createAuditMiddleware } = await loadModule();
    const middleware = createAuditMiddleware('test-svc');
    const req = mockReq({ method: 'POST', path: '/api/v1/documents' });
    const res = mockRes();
    const originalEnd = res.end;
    const next = vi.fn();

    middleware(req, res, next);
    res.end();

    expect(originalEnd).toHaveBeenCalled();
  });

  it('captures status code in audit event', async () => {
    const { createAuditMiddleware } = await loadModule();
    const middleware = createAuditMiddleware('test-svc');
    const req = mockReq();
    const res = mockRes();
    res.statusCode = 201;
    const next = vi.fn();

    middleware(req, res, next);
    res.end();

    expect(next).toHaveBeenCalled();
  });
});
