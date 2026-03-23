import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockMessagesCreate } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn(),
}));

vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: { create: mockMessagesCreate },
  })),
}));

vi.mock('../../src/config/index.js', () => ({
  config: {
    twilio: {
      accountSid: 'test-sid',
      authToken: 'test-token',
      fromNumber: '+1234567890',
    },
  },
}));

import { smsDeliverer } from '../../src/channels/sms.js';

beforeEach(() => vi.clearAllMocks());

describe('smsDeliverer', () => {
  it('has type "sms"', () => {
    expect(smsDeliverer.type).toBe('sms');
  });

  it('sends SMS via Twilio', async () => {
    mockMessagesCreate.mockResolvedValue({ sid: 'msg123' });

    const result = await smsDeliverer.deliver(
      { phone: '+1987654321' },
      { body: 'Your code is 123456' },
    );

    expect(result).toEqual({ success: true });
    expect(mockMessagesCreate).toHaveBeenCalledWith({
      body: 'Your code is 123456',
      from: '+1234567890',
      to: '+1987654321',
    });
  });

  it('returns error when no phone configured', async () => {
    const result = await smsDeliverer.deliver({}, { body: 'test' });
    expect(result).toEqual({ success: false, error: 'No phone number configured' });
  });

  it('returns error on Twilio failure', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('Invalid phone number'));

    const result = await smsDeliverer.deliver(
      { phone: '+invalid' },
      { body: 'test' },
    );

    expect(result).toEqual({ success: false, error: 'Invalid phone number' });
  });

  it('sends empty body when notification body is undefined', async () => {
    mockMessagesCreate.mockResolvedValue({});

    await smsDeliverer.deliver(
      { phone: '+1111111111' },
      {},
    );

    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ body: '' }),
    );
  });
});
