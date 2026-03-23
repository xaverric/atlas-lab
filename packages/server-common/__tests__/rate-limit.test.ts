import { describe, it, expect } from 'vitest';
import { createRateLimiter, apiRateLimiter, writeRateLimiter } from '../src/middleware/rate-limit.js';

describe('rate-limit', () => {
  it('createRateLimiter returns a middleware function', () => {
    const limiter = createRateLimiter(1000, 5);
    expect(typeof limiter).toBe('function');
  });

  it('apiRateLimiter is exported as a function', () => {
    expect(typeof apiRateLimiter).toBe('function');
  });

  it('writeRateLimiter is exported as a function', () => {
    expect(typeof writeRateLimiter).toBe('function');
  });

  it('createRateLimiter with defaults returns a function', () => {
    const limiter = createRateLimiter();
    expect(typeof limiter).toBe('function');
  });
});
