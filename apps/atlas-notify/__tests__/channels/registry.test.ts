import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/index.js', () => ({
  config: {
    smtp: { host: '' },
    telegram: { botToken: '' },
    vapid: { publicKey: '', privateKey: '', subject: '' },
    twilio: { accountSid: '', authToken: '', fromNumber: '', whatsappFrom: '' },
    signal: { cliUrl: '', fromNumber: '' },
  },
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn() },
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

vi.mock('twilio', () => ({
  default: vi.fn(),
}));

import { registerChannel, getDeliverer } from '../../src/channels/registry.js';
import type { ChannelDeliverer } from '../../src/channels/types.js';

beforeEach(() => vi.clearAllMocks());

describe('channel registry', () => {
  it('has built-in deliverers registered', () => {
    expect(getDeliverer('in_app')).toBeDefined();
    expect(getDeliverer('email')).toBeDefined();
    expect(getDeliverer('telegram')).toBeDefined();
    expect(getDeliverer('web_push')).toBeDefined();
    expect(getDeliverer('sms')).toBeDefined();
    expect(getDeliverer('signal')).toBeDefined();
    expect(getDeliverer('whatsapp')).toBeDefined();
  });

  it('returns undefined for unknown type', () => {
    expect(getDeliverer('carrier_pigeon')).toBeUndefined();
  });

  it('registers a custom channel', () => {
    const custom: ChannelDeliverer = {
      type: 'custom_push',
      async deliver() {
        return { success: true };
      },
    };

    registerChannel(custom);
    expect(getDeliverer('custom_push')).toBe(custom);
  });

  it('overrides existing channel when re-registered', () => {
    const replacement: ChannelDeliverer = {
      type: 'in_app',
      async deliver() {
        return { success: true };
      },
    };

    registerChannel(replacement);
    expect(getDeliverer('in_app')).toBe(replacement);
  });
});
