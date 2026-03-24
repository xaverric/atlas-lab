export const config = {
  port: Number(process.env.PORT) || 4001,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/atlas-dms',
  keycloak: {
    issuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/atlas',
    publicIssuer: process.env.KEYCLOAK_PUBLIC_ISSUER || process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/atlas',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  notifyUrl: process.env.NOTIFY_URL || 'http://localhost:4003',
  internalKey: process.env.INTERNAL_KEY || 'dev-internal-key',
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
    publicUrl: process.env.MINIO_PUBLIC_URL || '',
    accessKey: process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.MINIO_SECRET_KEY || '',
    bucket: process.env.MINIO_BUCKET || 'atlas-dms',
    region: process.env.MINIO_REGION || 'us-east-1',
  },
};
