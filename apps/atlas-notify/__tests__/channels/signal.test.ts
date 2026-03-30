import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/index.js', () => ({
  config: {
    signal: {
      cliUrl: 'http://signal.test',
      fromNumber: '+420111222333',
    },
  },
}));

import { signalDeliverer } from '../../src/channels/signal.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => vi.clearAllMocks());

describe('signalDeliverer', () => {
  it('has type "signal"', () => {
    expect(signalDeliverer.type).toBe('signal');
  });

  it('sends a message through the Signal REST API', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const result = await signalDeliverer.deliver(
      { signalNumber: '+420999888777' },
      { body: 'Signal payload' },
    );

    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://signal.test/v2/send',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.number).toBe('+420111222333');
    expect(body.recipients).toEqual(['+420999888777']);
    expect(body.message).toBe('Signal payload');
  });

  it('returns an error when no Signal number is configured', async () => {
    await expect(signalDeliverer.deliver({}, { body: 'test' })).resolves.toEqual({
      success: false,
      error: 'No Signal number configured',
    });
  });

  it('returns API errors with status context', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'Bad gateway',
    });

    const result = await signalDeliverer.deliver(
      { signalNumber: '+420999888777' },
      { body: 'Signal payload' },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Signal API error (502)');
  });
});
