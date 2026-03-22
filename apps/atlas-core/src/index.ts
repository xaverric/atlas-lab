import { logAuditEvent } from '@atlas/server-common';
import { config } from './config/index.js';
import { connectDB } from './config/db.js';
import * as auditDao from './daos/auditDao.js';
import { createApp } from './app.js';

const app = createApp();

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
