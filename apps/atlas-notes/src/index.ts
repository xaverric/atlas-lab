import { connectDB, logAuditEvent } from '@atlas/server-common';
import { config } from './config/index.js';
import { ensureCollection } from './services/vectorService.js';
import { createApp } from './app.js';

const auditMongoUri = process.env.AUDIT_MONGODB_URI || 'mongodb://localhost:27017/atlas-audit';
const app = createApp();

const start = async () => {
  await connectDB(config.mongoUri);
  await ensureCollection().catch((err) => console.error('Qdrant init failed (will retry on use):', err.message));
  app.listen(config.port, () => {
    console.log(`atlas-notes running on port ${config.port}`);
    logAuditEvent(auditMongoUri, {
      service: 'atlas-notes', action: 'service.started', category: 'system',
      details: { version: process.env.APP_VERSION || 'dev', nodeVersion: process.version, uptime: process.uptime() },
    });
  });
};

start();
