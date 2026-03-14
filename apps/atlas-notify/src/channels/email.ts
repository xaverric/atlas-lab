import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

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
