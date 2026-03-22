import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDB, errorHandler, createAuditMiddleware, logAuditEvent } from '@atlas/server-common';
import { createEventBus } from '@atlas/event-bus';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { syncJobs, worker, setEventBus } from './workers/scheduler.js';

const auditMongoUri = process.env.AUDIT_MONGODB_URI || 'mongodb://localhost:27017/atlas-audit';
const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(createAuditMiddleware('atlas-scheduler', auditMongoUri));
app.use(routes);
app.use(errorHandler);

const eventBus = createEventBus(config.redis);

const start = async () => {
  await connectDB(config.mongoUri);
  setEventBus(eventBus);
  await syncJobs();

  app.listen(config.port, () => {
    console.log(`atlas-scheduler running on port ${config.port}`);
    logAuditEvent(auditMongoUri, {
      service: 'atlas-scheduler',
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

process.on('SIGTERM', async () => {
  await eventBus.close();
  await worker.close();
  process.exit(0);
});

start();
