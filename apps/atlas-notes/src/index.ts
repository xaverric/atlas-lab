import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDB, errorHandler, createAuditMiddleware, logAuditEvent } from '@atlas/server-common';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { ensureCollection } from './services/vectorService.js';

const auditMongoUri = process.env.AUDIT_MONGODB_URI || 'mongodb://localhost:27017/atlas-audit';
const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(createAuditMiddleware('atlas-notes', auditMongoUri));
app.use(routes);
app.use(errorHandler);

const start = async () => {
  await connectDB(config.mongoUri);
  await ensureCollection().catch((err) => console.error('Qdrant init failed (will retry on use):', err.message));
  app.listen(config.port, () => {
    console.log(`atlas-notes running on port ${config.port}`);
    logAuditEvent(auditMongoUri, {
      service: 'atlas-notes',
      action: 'service.started',
      category: 'system',
      details: {
        version: process.env.APP_VERSION || 'dev',
        nodeVersion: process.version,
        uptime: process.uptime(),
      },
    });
  });
};

start();
