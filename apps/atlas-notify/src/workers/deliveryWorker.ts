import { Worker } from 'bullmq';
import { config } from '../config/index.js';
import { sendEmail } from '../channels/email.js';
import { sendTelegram } from '../channels/telegram.js';
import * as notificationDao from '../daos/notificationDao.js';

const connection = { host: config.redis.host, port: config.redis.port };

export const worker = new Worker('atlas-notify', async (job) => {
  const { notificationId, channel, to, subject, body } = job.data;

  try {
    if (channel === 'email') {
      await sendEmail(to, subject, body);
    } else if (channel === 'telegram') {
      await sendTelegram(to, `*${subject}*\n\n${body}`);
    }

    await notificationDao.updateById(notificationId, { status: 'sent' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await notificationDao.updateById(notificationId, { status: 'failed', error: message });
    throw err;
  }
}, { connection, concurrency: 3 });
