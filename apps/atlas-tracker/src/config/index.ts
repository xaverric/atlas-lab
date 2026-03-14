export const config = {
  port: Number(process.env.PORT) || 4006,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/atlas-tracker',
  keycloak: {
    issuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/atlas',
    publicIssuer: process.env.KEYCLOAK_PUBLIC_ISSUER || process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/atlas',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  publicRateLimit: {
    windowMs: 60 * 1000,
    max: 60,
  },
};
