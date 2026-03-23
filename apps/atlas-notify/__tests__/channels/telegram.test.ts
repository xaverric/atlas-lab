import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/index.js', () => ({
  config: {
    telegram: { botToken: 'test-bot-token' },
  },
}));

import { telegramDeliverer, sendTelegram } from '../../src/channels/telegram.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => vi.clearAllMocks());

describe('telegramDeliverer', () => {
  it('has type "telegram"', () => {
    expect(telegramDeliverer.type).toBe('telegram');
  });

  it('sends message to Telegram API', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const result = await telegramDeliverer.deliver(
      { chatId: '12345' },
      { subject: 'Alert', body: 'Something happened' },
    );

    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-bot-token/sendMessage',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('12345');
    expect(body.text).toContain('Alert');
    expect(body.text).toContain('Something happened');
    expect(body.parse_mode).toBe('Markdown');
  });

  it('returns error when no chatId configured', async () => {
    const result = await telegramDeliverer.deliver({}, { body: 'test' });
    expect(result).toEqual({ success: false, error: 'No chat ID configured' });
  });

  it('returns error on API failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });

    const result = await telegramDeliverer.deliver(
      { chatId: '12345' },
      { body: 'test' },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Telegram API error');
    expect(result.error).toContain('403');
  });

  it('uses title as bold markdown header', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await telegramDeliverer.deliver(
      { chatId: '123' },
      { title: 'Important', body: 'Details' },
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toBe('*Important*\n\nDetails');
  });
});

describe('sendTelegram', () => {
  it('posts to Telegram API', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await sendTelegram('12345', 'Hello');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-bot-token/sendMessage',
      expect.any(Object),
    );
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal error',
    });

    await expect(sendTelegram('12345', 'Hi')).rejects.toThrow('Telegram API error (500)');
  });
});
