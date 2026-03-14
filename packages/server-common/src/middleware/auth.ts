import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { RequestHandler } from 'express';
import { ApiError } from '@atlas/core';

export interface AuthPayload extends JWTPayload {
  sub: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  realm_access?: { roles: string[] };
}

declare global {
  namespace Express {
    interface Request {
      auth: AuthPayload;
    }
  }
}

interface AuthOptions {
  issuer: string;
  publicIssuer?: string;
}

export const createAuth = ({ issuer, publicIssuer }: AuthOptions): RequestHandler => {
  const jwks = createRemoteJWKSet(
    new URL(`${issuer}/protocol/openid-connect/certs`),
  );

  return async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return next(new ApiError(401, 'Authentication required'));
    }

    try {
      const token = header.split(' ')[1];
      const { payload } = await jwtVerify(token, jwks, {
        issuer: publicIssuer || issuer,
      });

      if (!payload.sub) {
        return next(new ApiError(401, 'Invalid token: missing sub claim'));
      }

      req.auth = payload as AuthPayload;
      next();
    } catch {
      next(new ApiError(401, 'Invalid or expired token'));
    }
  };
};
