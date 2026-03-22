import rateLimit from 'express-rate-limit';

export const createRateLimiter = (windowMs = 60_000, max = 100) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });

export const apiRateLimiter = createRateLimiter(60_000, 100);
export const authRateLimiter = createRateLimiter(60_000, 20);
export const writeRateLimiter = createRateLimiter(60_000, 30);
