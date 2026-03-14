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
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'AtlasNotifyBot',
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@xaverric.cz',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '',
  },
  signal: {
    cliUrl: process.env.SIGNAL_CLI_URL || 'http://signal-cli:8080',
    fromNumber: process.env.SIGNAL_FROM_NUMBER || '',
  },
  eventBus: {
    enabled: process.env.EVENT_BUS_ENABLED !== 'false',
  },
};
