import type { RequestHandler } from 'express';
import { type ZodSchema, ZodError } from 'zod';
import { ApiError } from '@atlas/core';

type Source = 'body' | 'query' | 'params';

export const validate = (schema: ZodSchema, source: Source = 'body'): RequestHandler => {
  return (req, _res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details: Record<string, string[]> = {};
        for (const issue of err.issues) {
          const key = issue.path.join('.');
          details[key] = details[key] || [];
          details[key].push(issue.message);
        }
        return next(new ApiError(400, 'Validation failed', details));
      }
      next(err);
    }
  };
};
