import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createAuditMiddleware, logAuditEvent } from '@atlas/server-common';
import { config } from './config/index.js';
import { connectDB } from './config/db.js';
import * as auditDao from './daos/auditDao.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(createAuditMiddleware('atlas-core', config.auditMongoUri));
app.use(routes);
app.use(errorHandler);

const start = async () => {
  await connectDB();
  await auditDao.connect(config.auditMongoUri);

  app.listen(config.port, () => {
    console.log(`atlas-core running on port ${config.port}`);
    logAuditEvent(config.auditMongoUri, {
      service: 'atlas-core',
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
