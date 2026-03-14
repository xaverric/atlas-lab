import { createAuth } from '@atlas/server-common';
import { config } from '../config/index.js';

export type { AuthPayload } from '@atlas/server-common';

export const auth = createAuth({
  issuer: config.keycloak.issuer,
  publicIssuer: config.keycloak.publicIssuer,
});
