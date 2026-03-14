export const config = {
  port: Number(process.env.PORT) || 4004,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/atlas-notes',
  keycloak: {
    issuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/atlas',
    publicIssuer: process.env.KEYCLOAK_PUBLIC_ISSUER || process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/atlas',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collection: process.env.QDRANT_COLLECTION || 'atlas-notes',
  },
  ollama: {
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'nomic-embed-text',
  },
};
