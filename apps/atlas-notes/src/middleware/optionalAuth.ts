import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { RequestHandler } from 'express';
import { config } from '../config/index.js';

const jwks = createRemoteJWKSet(
  new URL(`${config.keycloak.issuer}/protocol/openid-connect/certs`),
);

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  try {
    const token = header.split(' ')[1];
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.keycloak.publicIssuer || config.keycloak.issuer,
    });

    if (payload.sub) {
      req.auth = payload as any;
    }
  } catch {
    // invalid token is fine for optional auth
  }

  next();
};
