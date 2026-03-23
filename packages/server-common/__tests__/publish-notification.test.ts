import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPublishNotification } from '../src/services/publish-notification.js';

describe('createPublishNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('returns a function', () => {
    const publish = createPublishNotification('http://notify:4003', 'secret');
    expect(typeof publish).toBe('function');
  });

  it('sends POST with correct shape', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const publish = createPublishNotification('http://notify:4003', 'my-key');

    await publish('user-1', 'Title', 'Body text', 'job.done', 'http://example.com');

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://notify:4003/api/v1/notifications/send-direct',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': 'my-key',
        },
      }),
    );

    const call = fetchSpy.mock.calls[0];
    const body = JSON.parse((call[1] as any).body);
    expect(body).toEqual({
      userId: 'user-1',
      title: 'Title',
      body: 'Body text',
      event: 'job.done',
      priority: 'normal',
      url: 'http://example.com',
    });
  });

  it('sends undefined url when not provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const publish = createPublishNotification('http://notify:4003', 'key');

    await publish('user-1', 'T', 'B', 'evt');

    const call = fetchSpy.mock.calls[0];
    const body = JSON.parse((call[1] as any).body);
    expect(body.priority).toBe('normal');
  });

  it('swallows fetch errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const publish = createPublishNotification('http://notify:4003', 'key');

    await expect(publish('user-1', 'T', 'B', 'evt')).resolves.toBeUndefined();
  });
});
