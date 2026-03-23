import { describe, it, expect, vi, beforeEach } from 'vitest';

import { n8nExecutor } from '../../src/executors/n8n.js';

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

describe('n8nExecutor', () => {
  it('triggers webhook with POST and payload', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => '{"success":true}' });

    const result = await n8nExecutor.execute(
      { webhookUrl: 'https://n8n.example.com/webhook/abc', payload: { key: 'val' } },
      5000,
      makeCtx(),
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('{"success":true}');
    expect(result.error).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://n8n.example.com/webhook/abc',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"key":"val"}',
      }),
    );
  });

  it('sends empty object when no payload', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => 'ok' });

    await n8nExecutor.execute(
      { webhookUrl: 'https://n8n.example.com/webhook/abc' },
      5000,
      makeCtx(),
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: '{}' }),
    );
  });

  it('returns error for 4xx/5xx status', async () => {
    mockFetch.mockResolvedValue({ status: 500, text: async () => 'Internal Server Error' });

    const result = await n8nExecutor.execute(
      { webhookUrl: 'https://n8n.example.com/webhook/abc' },
      5000,
      makeCtx(),
    );

    expect(result.statusCode).toBe(500);
    expect(result.error).toContain('500');
  });

  it('returns error on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await n8nExecutor.execute(
      { webhookUrl: 'https://n8n.example.com/webhook/abc' },
      5000,
      makeCtx(),
    );

    expect(result.error).toBe('ECONNREFUSED');
    expect(result.statusCode).toBeUndefined();
  });

  it('truncates response body at 50KB', async () => {
    const bigBody = 'y'.repeat(60_000);
    mockFetch.mockResolvedValue({ status: 200, text: async () => bigBody });

    const result = await n8nExecutor.execute(
      { webhookUrl: 'https://n8n.example.com/webhook/abc' },
      5000,
      makeCtx(),
    );

    expect(result.body!.length).toBeLessThanOrEqual(50_000);
  });

  it('does not return error for successful status codes', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => 'ok' });

    const result = await n8nExecutor.execute(
      { webhookUrl: 'https://n8n.example.com/webhook/abc' },
      5000,
      makeCtx(),
    );

    expect(result.error).toBeUndefined();
  });

  it('returns error for 400 status', async () => {
    mockFetch.mockResolvedValue({ status: 400, text: async () => 'Bad Request' });

    const result = await n8nExecutor.execute(
      { webhookUrl: 'https://n8n.example.com/webhook/abc' },
      5000,
      makeCtx(),
    );

    expect(result.error).toContain('400');
  });
});
