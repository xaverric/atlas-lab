import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDB, errorHandler, createAuditMiddleware, logAuditEvent } from '@atlas/server-common';
import { config } from './config/index.js';
import routes from './routes/index.js';

const auditMongoUri = process.env.AUDIT_MONGODB_URI || 'mongodb://localhost:27017/atlas-audit';
const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(createAuditMiddleware('atlas-dms', auditMongoUri));
app.use(routes);
app.use(errorHandler);

const start = async () => {
  await connectDB(config.mongoUri);
  app.listen(config.port, () => {
    console.log(`atlas-dms (file storage) running on port ${config.port}`);
    logAuditEvent(auditMongoUri, {
      service: 'atlas-dms',
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
