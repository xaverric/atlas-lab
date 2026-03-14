import type { ErrorRequestHandler } from 'express';
import { ApiError } from '@atlas/core';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
};
