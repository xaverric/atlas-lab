import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createAuditMiddleware } from '@atlas/server-common';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';

export const createApp = () => {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(createAuditMiddleware('atlas-core', config.auditMongoUri));
  app.use(routes);
  app.use(errorHandler);
  return app;
};
