import twilio from 'twilio';
import { config } from '../config/index.js';
import type { ChannelDeliverer } from './types.js';

const client = config.twilio.accountSid && config.twilio.authToken && config.twilio.whatsappFrom
  ? twilio(config.twilio.accountSid, config.twilio.authToken)
  : null;

if (!client) console.warn('Twilio WhatsApp not configured - WhatsApp channel disabled');

export const whatsappDeliverer: ChannelDeliverer = {
  type: 'whatsapp',
  async deliver(channelConfig, notification) {
    if (!client) return { success: false, error: 'Twilio WhatsApp not configured' };

    const phone = channelConfig.phone as string;
    if (!phone) return { success: false, error: 'No phone number configured' };

    try {
      await client.messages.create({
        body: notification.body || '',
        from: `whatsapp:${config.twilio.whatsappFrom}`,
        to: `whatsapp:${phone}`,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
