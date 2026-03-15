export const config = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/atlas',
  auditMongoUri: process.env.AUDIT_MONGODB_URI || 'mongodb://localhost:27017/atlas-audit',
  keycloak: {
    issuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/atlas',
    publicIssuer: process.env.KEYCLOAK_PUBLIC_ISSUER || process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/atlas',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  notifyUrl: process.env.NOTIFY_URL || 'http://localhost:4003',
  internalKey: process.env.INTERNAL_KEY || 'dev-internal-key',
};
