import twilio from 'twilio';
import { config } from '../config/index.js';
import type { ChannelDeliverer } from './types.js';

const client = config.twilio.accountSid && config.twilio.authToken
  ? twilio(config.twilio.accountSid, config.twilio.authToken)
  : null;

if (!client) console.warn('Twilio not configured - SMS channel disabled');

export const smsDeliverer: ChannelDeliverer = {
  type: 'sms',
  async deliver(channelConfig, notification) {
    if (!client) return { success: false, error: 'Twilio not configured' };

    const phone = channelConfig.phone as string;
    if (!phone) return { success: false, error: 'No phone number configured' };

    try {
      await client.messages.create({
        body: notification.body || '',
        from: config.twilio.fromNumber,
        to: phone,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
