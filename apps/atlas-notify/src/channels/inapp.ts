import type { ChannelDeliverer } from './types.js';

export const inAppDeliverer: ChannelDeliverer = {
  type: 'in_app',
  async deliver() {
    // in-app is handled by eventProcessor (creates DB record + pushes SSE)
    return { success: true };
  },
};
