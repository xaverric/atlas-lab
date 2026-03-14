import { config } from '../config/index.js';

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
