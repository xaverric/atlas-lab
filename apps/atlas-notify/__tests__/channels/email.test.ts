import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
  },
}));

vi.mock('../../src/config/index.js', () => ({
  config: {
    smtp: {
      host: 'smtp.test.com',
      port: 587,
      user: 'user',
      pass: 'pass',
      from: 'atlas@test.com',
    },
  },
}));

import { emailDeliverer, sendEmail } from '../../src/channels/email.js';

beforeEach(() => vi.clearAllMocks());

describe('emailDeliverer', () => {
  it('has type "email"', () => {
    expect(emailDeliverer.type).toBe('email');
  });

  it('sends email via channel config address', async () => {
    mockSendMail.mockResolvedValue({});

    const result = await emailDeliverer.deliver(
      { address: 'user@test.com' },
      { subject: 'Test Subject', body: 'Test Body' },
    );

    expect(result).toEqual({ success: true });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'atlas@test.com',
      to: 'user@test.com',
      subject: 'Test Subject',
      text: 'Test Body',
    });
  });

  it('returns error when no address configured', async () => {
    const result = await emailDeliverer.deliver({}, { subject: 'S', body: 'B' });
    expect(result).toEqual({ success: false, error: 'No email address configured' });
  });

  it('returns error on SMTP failure', async () => {
    mockSendMail.mockRejectedValue(new Error('Connection refused'));

    const result = await emailDeliverer.deliver(
      { address: 'user@test.com' },
      { subject: 'S', body: 'B' },
    );

    expect(result).toEqual({ success: false, error: 'Connection refused' });
  });

  it('uses title when subject is missing', async () => {
    mockSendMail.mockResolvedValue({});

    await emailDeliverer.deliver(
      { address: 'user@test.com' },
      { title: 'Title Only', body: 'B' },
    );

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Title Only' }),
    );
  });
});

describe('sendEmail', () => {
  it('sends mail directly', async () => {
    mockSendMail.mockResolvedValue({});

    await sendEmail('to@test.com', 'Subject', 'Body');

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'atlas@test.com',
      to: 'to@test.com',
      subject: 'Subject',
      text: 'Body',
    });
  });
});
