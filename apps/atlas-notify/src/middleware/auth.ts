import { createAuth } from '@atlas/server-common';
import type { RequestHandler } from 'express';
import { ApiError } from '@atlas/core';
import { config } from '../config/index.js';

export type { AuthPayload } from '@atlas/server-common';

export const auth = createAuth({
  issuer: config.keycloak.issuer,
  publicIssuer: config.keycloak.publicIssuer,
});

export const internalAuth: RequestHandler = (req, _res, next) => {
  const key = req.headers['x-internal-key'];
  if (key !== config.internalKey) {
    return next(new ApiError(401, 'Invalid internal key'));
  }
  next();
};
