import { config } from '../config/index.js';
import { NotificationChannel } from '../models/NotificationChannel.js';

const POLL_INTERVAL = 3000;
let running = false;
let offset = 0;

const processUpdate = async (update: Record<string, unknown>) => {
  const message = update.message as Record<string, unknown> | undefined;
  if (!message) return;

  const text = message.text as string | undefined;
  const chat = message.chat as Record<string, unknown> | undefined;
  if (!text || !chat) return;

  const match = text.match(/^\/start\s+(.+)$/);
  if (!match) return;

  const code = match[1];
  const chatId = String(chat.id);

  const channel = await NotificationChannel.findOne({
    type: 'telegram',
    verificationCode: code,
    verificationExpiresAt: { $gt: new Date() },
  });

  if (!channel) {
    await sendMessage(chatId, 'Invalid or expired verification code.');
    return;
  }

  channel.config = { ...(channel.config as Record<string, unknown> || {}), chatId };
  channel.verified = true;
  channel.verificationCode = undefined;
  channel.verificationExpiresAt = undefined;
  await channel.save();

  await sendMessage(chatId, 'Your Telegram channel has been verified! You will now receive notifications here.');
};

const sendMessage = async (chatId: string, text: string) => {
  const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {});
};

const poll = async () => {
  if (!running) return;

  try {
    const url = `https://api.telegram.org/bot${config.telegram.botToken}/getUpdates?offset=${offset}&timeout=30`;
    const res = await fetch(url);
    const data = await res.json() as { ok: boolean; result: Array<Record<string, unknown>> };

    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        await processUpdate(update);
        offset = (update.update_id as number) + 1;
      }
    }
  } catch {}

  setTimeout(poll, POLL_INTERVAL);
};

export const startTelegramBot = () => {
  if (!config.telegram.botToken) return;
  running = true;
  console.log('Telegram bot listener started');
  poll();
};

export const stopTelegramBot = () => {
  running = false;
};
