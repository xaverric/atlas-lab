import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({
    add: vi.fn(), remove: vi.fn(), close: vi.fn(),
    upsertJobScheduler: vi.fn(), getJob: vi.fn(), removeJobScheduler: vi.fn(),
  })),
  Worker: vi.fn(() => ({ on: vi.fn(), close: vi.fn() })),
}));

import { webhookExecutor } from '../../src/executors/webhook.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => vi.clearAllMocks());

const makeCtx = () => ({
  jobId: 'j1',
  runId: 'r1',
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
  env: {},
});

describe('webhookExecutor', () => {
  it('makes a successful GET request', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      text: async () => '{"ok":true}',
    });

    const result = await webhookExecutor.execute(
      { url: 'https://example.com/api', method: 'GET' },
      5000,
      makeCtx(),
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('{"ok":true}');
    expect(result.error).toBeUndefined();
  });

  it('sends POST with body and Content-Type', async () => {
    mockFetch.mockResolvedValue({
      status: 201,
      text: async () => 'created',
    });

    await webhookExecutor.execute(
      { url: 'https://example.com/api', method: 'POST', body: { key: 'val' } },
      5000,
      makeCtx(),
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'POST',
        body: '{"key":"val"}',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
  });

  it('sends custom headers', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => '' });

    await webhookExecutor.execute(
      { url: 'https://example.com', headers: { 'X-Custom': 'value' } },
      5000,
      makeCtx(),
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Custom': 'value' }),
      }),
    );
  });

  it('applies bearer auth', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => '' });

    await webhookExecutor.execute(
      { url: 'https://example.com', auth: { type: 'bearer', token: 'tok123' } },
      5000,
      makeCtx(),
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
      }),
    );
  });

  it('applies basic auth', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => '' });

    await webhookExecutor.execute(
      { url: 'https://example.com', auth: { type: 'basic', username: 'user', password: 'pass' } },
      5000,
      makeCtx(),
    );

    const expectedAuth = `Basic ${Buffer.from('user:pass').toString('base64')}`;
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: expectedAuth }),
      }),
    );
  });

  it('blocks requests to internal hosts (SSRF)', async () => {
    const result = await webhookExecutor.execute(
      { url: 'http://localhost:8080/admin' },
      5000,
      makeCtx(),
    );

    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('not allowed');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('blocks requests to private IPs', async () => {
    const result = await webhookExecutor.execute(
      { url: 'http://192.168.1.1/secret' },
      5000,
      makeCtx(),
    );

    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('not allowed');
  });

  it('blocks requests to internal service names', async () => {
    const result = await webhookExecutor.execute(
      { url: 'http://atlas-core:4000/health' },
      5000,
      makeCtx(),
    );

    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('not allowed');
  });

  it('returns error for non-2xx with evaluation failures', async () => {
    mockFetch.mockResolvedValue({ status: 500, text: async () => 'Internal error' });

    const result = await webhookExecutor.execute(
      {
        url: 'https://example.com',
        evaluationRules: [{ type: 'statusEquals', value: 200 }],
      },
      5000,
      makeCtx(),
    );

    expect(result.statusCode).toBe(500);
    expect(result.evaluationResults).toBeDefined();
    expect(result.evaluationResults![0].passed).toBe(false);
    expect(result.error).toBe('Evaluation rules failed');
  });

  it('passes statusEquals evaluation rule', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => 'ok' });

    const result = await webhookExecutor.execute(
      {
        url: 'https://example.com',
        evaluationRules: [{ type: 'statusEquals', value: 200 }],
      },
      5000,
      makeCtx(),
    );

    expect(result.evaluationResults![0].passed).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('evaluates bodyContains rule', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => 'Hello World' });

    const result = await webhookExecutor.execute(
      {
        url: 'https://example.com',
        evaluationRules: [{ type: 'bodyContains', value: 'Hello' }],
      },
      5000,
      makeCtx(),
    );

    expect(result.evaluationResults![0].passed).toBe(true);
  });

  it('returns error on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await webhookExecutor.execute(
      { url: 'https://example.com' },
      5000,
      makeCtx(),
    );

    expect(result.error).toBe('Network error');
  });

  it('truncates response body at 50KB', async () => {
    const bigBody = 'x'.repeat(60_000);
    mockFetch.mockResolvedValue({ status: 200, text: async () => bigBody });

    const result = await webhookExecutor.execute(
      { url: 'https://example.com' },
      5000,
      makeCtx(),
    );

    expect(result.body!.length).toBeLessThanOrEqual(50_000);
  });
});
