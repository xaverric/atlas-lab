export const config = {
  port: Number(process.env.PORT) || 4003,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/atlas-notify',
  keycloak: {
    issuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/atlas',
    publicIssuer: process.env.KEYCLOAK_PUBLIC_ISSUER || process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/atlas',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  internalKey: process.env.INTERNAL_KEY || 'dev-internal-key',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'atlas@xaverric.cz',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },
};
