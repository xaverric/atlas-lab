export const config = {
  port: Number(process.env.PORT) || 4005,
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${Number(process.env.PORT) || 4005}`,
  keycloak: {
    issuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/atlas',
    publicIssuer: process.env.KEYCLOAK_PUBLIC_ISSUER || process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/atlas',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'atlas-mcp',
  },
  corsOrigin: process.env.CORS_ORIGIN || '*',
  services: {
    core: process.env.CORE_URL || 'http://localhost:4000',
    dms: process.env.DMS_URL || 'http://localhost:4001',
    scheduler: process.env.SCHEDULER_URL || 'http://localhost:4002',
    notify: process.env.NOTIFY_URL || 'http://localhost:4003',
    notes: process.env.NOTES_URL || 'http://localhost:4004',
    tracker: process.env.TRACKER_URL || 'http://localhost:4006',
  },
};
