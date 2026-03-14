export const config = {
  port: Number(process.env.PORT) || 4002,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/atlas-scheduler',
  keycloak: {
    issuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/atlas',
    publicIssuer: process.env.KEYCLOAK_PUBLIC_ISSUER || process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/atlas',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
};
