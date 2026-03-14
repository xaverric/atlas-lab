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
  notifyUrl: process.env.NOTIFY_URL || 'http://localhost:4003',
  internalKey: process.env.INTERNAL_KEY || 'dev-internal-key',
  maxRunsPerJob: Number(process.env.MAX_RUNS_PER_JOB) || 100,
  allowShellExec: process.env.ALLOW_SHELL_EXEC === 'true',
};
