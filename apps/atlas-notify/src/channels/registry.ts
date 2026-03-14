import type { ChannelDeliverer } from './types.js';
import { inAppDeliverer } from './inapp.js';
import { emailDeliverer } from './email.js';
import { telegramDeliverer } from './telegram.js';
import { webPushDeliverer } from './webpush.js';
import { signalDeliverer } from './signal.js';
import { whatsappDeliverer } from './whatsapp.js';
import { smsDeliverer } from './sms.js';

const deliverers = new Map<string, ChannelDeliverer>();

export const registerChannel = (deliverer: ChannelDeliverer) => {
  deliverers.set(deliverer.type, deliverer);
};

export const getDeliverer = (type: string): ChannelDeliverer | undefined =>
  deliverers.get(type);

registerChannel(inAppDeliverer);
registerChannel(emailDeliverer);
registerChannel(telegramDeliverer);
registerChannel(webPushDeliverer);
registerChannel(signalDeliverer);
registerChannel(whatsappDeliverer);
registerChannel(smsDeliverer);
