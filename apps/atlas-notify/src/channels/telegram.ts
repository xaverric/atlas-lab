import { config } from '../config/index.js';
import type { ChannelDeliverer } from './types.js';

export const sendTelegram = async (chatId: string, text: string) => {
  if (!config.telegram.botToken) throw new Error('Telegram bot token not configured');

  const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error (${res.status}): ${body}`);
  }
};

export const telegramDeliverer: ChannelDeliverer = {
  type: 'telegram',
  async deliver(channelConfig, notification) {
    const chatId = channelConfig.chatId as string;
    if (!chatId) return { success: false, error: 'No chat ID configured' };

    const text = `*${notification.subject || notification.title || ''}*\n\n${notification.body || ''}`;

    try {
      await sendTelegram(chatId, text);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
