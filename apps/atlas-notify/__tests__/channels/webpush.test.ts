import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendNotification } = vi.hoisted(() => ({
  mockSendNotification: vi.fn(),
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: mockSendNotification,
  },
}));

vi.mock('../../src/config/index.js', () => ({
  config: {
    vapid: {
      publicKey: 'test-public-key',
      privateKey: 'test-private-key',
      subject: 'mailto:test@test.com',
    },
  },
}));

import { webPushDeliverer } from '../../src/channels/webpush.js';

beforeEach(() => vi.clearAllMocks());

describe('webPushDeliverer', () => {
  it('has type "web_push"', () => {
    expect(webPushDeliverer.type).toBe('web_push');
  });

  it('sends push notification', async () => {
    mockSendNotification.mockResolvedValue({});

    const subscription = {
      endpoint: 'https://push.example.com/sub/123',
      keys: { p256dh: 'key1', auth: 'key2' },
    };

    const result = await webPushDeliverer.deliver(
      { subscription },
      { title: 'Alert', body: 'Details' },
    );

    expect(result).toEqual({ success: true });
    expect(mockSendNotification).toHaveBeenCalledWith(
      subscription,
      JSON.stringify({ title: 'Alert', body: 'Details', url: '/notifications' }),
    );
  });

  it('returns error when no subscription', async () => {
    const result = await webPushDeliverer.deliver({}, { title: 'T' });
    expect(result).toEqual({ success: false, error: 'No push subscription' });
  });

  it('returns "Subscription expired" on 410 status', async () => {
    mockSendNotification.mockRejectedValue({ statusCode: 410, message: 'Gone' });

    const subscription = { endpoint: 'https://ex.com', keys: {} };
    const result = await webPushDeliverer.deliver(
      { subscription },
      { title: 'T' },
    );

    expect(result).toEqual({ success: false, error: 'Subscription expired' });
  });

  it('returns generic error on other failures', async () => {
    mockSendNotification.mockRejectedValue(new Error('Network error'));

    const subscription = { endpoint: 'https://ex.com', keys: {} };
    const result = await webPushDeliverer.deliver(
      { subscription },
      { title: 'T' },
    );

    expect(result).toEqual({ success: false, error: 'Network error' });
  });

  it('uses subject when title is missing', async () => {
    mockSendNotification.mockResolvedValue({});

    const subscription = { endpoint: 'https://ex.com', keys: {} };
    await webPushDeliverer.deliver(
      { subscription },
      { subject: 'SubjectTitle', body: 'B' },
    );

    const payload = JSON.parse(mockSendNotification.mock.calls[0][1]);
    expect(payload.title).toBe('SubjectTitle');
  });

  it('falls back to "Atlas" when no title or subject', async () => {
    mockSendNotification.mockResolvedValue({});

    const subscription = { endpoint: 'https://ex.com', keys: {} };
    await webPushDeliverer.deliver(
      { subscription },
      {},
    );

    const payload = JSON.parse(mockSendNotification.mock.calls[0][1]);
    expect(payload.title).toBe('Atlas');
  });
});
