import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: {
      create: mockCreate,
    },
  })),
}));

vi.mock('../../src/config/index.js', () => ({
  config: {
    twilio: {
      accountSid: 'sid',
      authToken: 'token',
      whatsappFrom: '+15550001111',
    },
  },
}));

import { whatsappDeliverer } from '../../src/channels/whatsapp.js';

beforeEach(() => vi.clearAllMocks());

describe('whatsappDeliverer', () => {
  it('has type "whatsapp"', () => {
    expect(whatsappDeliverer.type).toBe('whatsapp');
  });

  it('sends WhatsApp messages through Twilio', async () => {
    mockCreate.mockResolvedValue({});

    const result = await whatsappDeliverer.deliver(
      { phone: '+15550002222' },
      { body: 'WhatsApp payload' },
    );

    expect(result).toEqual({ success: true });
    expect(mockCreate).toHaveBeenCalledWith({
      body: 'WhatsApp payload',
      from: 'whatsapp:+15550001111',
      to: 'whatsapp:+15550002222',
    });
  });

  it('returns an error when phone is missing', async () => {
    await expect(whatsappDeliverer.deliver({}, { body: 'test' })).resolves.toEqual({
      success: false,
      error: 'No phone number configured',
    });
  });

  it('returns Twilio errors', async () => {
    mockCreate.mockRejectedValue(new Error('Twilio outage'));

    const result = await whatsappDeliverer.deliver(
      { phone: '+15550002222' },
      { body: 'WhatsApp payload' },
    );

    expect(result).toEqual({ success: false, error: 'Twilio outage' });
  });
});
