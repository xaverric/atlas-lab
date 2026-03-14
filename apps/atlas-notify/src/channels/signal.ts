import { config } from '../config/index.js';
import type { ChannelDeliverer } from './types.js';

const configured = !!config.signal.fromNumber;
if (!configured) console.warn('Signal not configured - Signal channel disabled');

export const signalDeliverer: ChannelDeliverer = {
  type: 'signal',
  async deliver(channelConfig, notification) {
    if (!configured) return { success: false, error: 'Signal not configured' };

    const signalNumber = channelConfig.signalNumber as string;
    if (!signalNumber) return { success: false, error: 'No Signal number configured' };

    try {
      const res = await fetch(`${config.signal.cliUrl}/v2/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: notification.body || '',
          number: config.signal.fromNumber,
          recipients: [signalNumber],
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Signal API error (${res.status}): ${body}`);
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
