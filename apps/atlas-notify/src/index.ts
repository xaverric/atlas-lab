import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDB, errorHandler } from '@atlas/server-common';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { worker } from './workers/deliveryWorker.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(routes);
app.use(errorHandler);

const start = async () => {
  await connectDB(config.mongoUri);
  app.listen(config.port, () => {
    console.log(`atlas-notify running on port ${config.port}`);
  });
};

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});

start();
