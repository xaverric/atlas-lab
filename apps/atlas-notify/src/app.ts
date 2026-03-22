import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler, apiRateLimiter, createAuditMiddleware } from '@atlas/server-common';
import { config } from './config/index.js';
import routes from './routes/index.js';

const auditMongoUri = process.env.AUDIT_MONGODB_URI || 'mongodb://localhost:27017/atlas-audit';

export const createApp = () => {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(apiRateLimiter);
  app.use(express.json({ limit: '1mb' }));
  app.use(createAuditMiddleware('atlas-notify', auditMongoUri));
  app.use(routes);
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);
  return app;
};
