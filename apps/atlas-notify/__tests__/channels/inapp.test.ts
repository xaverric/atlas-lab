import { describe, it, expect } from 'vitest';
import { inAppDeliverer } from '../../src/channels/inapp.js';

describe('inAppDeliverer', () => {
  it('has type "in_app"', () => {
    expect(inAppDeliverer.type).toBe('in_app');
  });

  it('returns success immediately', async () => {
    const result = await inAppDeliverer.deliver({}, { title: 'Test', body: 'Body' });
    expect(result).toEqual({ success: true });
  });

  it('ignores config and notification content', async () => {
    const result = await inAppDeliverer.deliver(
      { extra: 'stuff' },
      { title: '', subject: '', body: '' },
    );
    expect(result.success).toBe(true);
  });
});
