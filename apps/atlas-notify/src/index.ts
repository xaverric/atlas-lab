import { connectDB, logAuditEvent } from '@atlas/server-common';
import { createEventBus } from '@atlas/event-bus';
import { config } from './config/index.js';
import { worker } from './workers/deliveryWorker.js';
import { migratePreferences } from './migrations/migratePreferences.js';
import * as eventProcessor from './services/eventProcessor.js';
import { startTelegramBot, stopTelegramBot } from './channels/telegram-bot.js';
import { createApp } from './app.js';

const auditMongoUri = process.env.AUDIT_MONGODB_URI || 'mongodb://localhost:27017/atlas-audit';
const app = createApp();

const eventBus = config.eventBus.enabled
  ? createEventBus(config.redis)
  : null;

const start = async () => {
  await connectDB(config.mongoUri);
  await migratePreferences();

  if (eventBus) {
    eventProcessor.start(eventBus);
    console.log('Event bus connected');
  }

  startTelegramBot();

  app.listen(config.port, () => {
    console.log(`atlas-notify running on port ${config.port}`);
    logAuditEvent(auditMongoUri, {
      service: 'atlas-notify', action: 'service.started', category: 'system',
      details: { version: process.env.APP_VERSION || 'dev', nodeVersion: process.version, uptime: process.uptime() },
    });
  });
};

process.on('SIGTERM', async () => {
  stopTelegramBot();
  if (eventBus) await eventBus.close();
  await worker.close();
  process.exit(0);
});

start();
