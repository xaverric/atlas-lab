import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import type { ChannelDeliverer } from './types.js';

const transporter = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : null;

export const sendEmail = async (to: string, subject: string, body: string) => {
  if (!transporter) throw new Error('SMTP not configured');

  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text: body,
  });
};

export const emailDeliverer: ChannelDeliverer = {
  type: 'email',
  async deliver(channelConfig, notification) {
    const to = channelConfig.address as string;
    if (!to) return { success: false, error: 'No email address configured' };

    try {
      await sendEmail(to, notification.subject || notification.title || '', notification.body || '');
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
