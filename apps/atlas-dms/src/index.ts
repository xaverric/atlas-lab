import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDB } from '@atlas/server-common';
import { errorHandler } from '@atlas/server-common';
import { config } from './config/index.js';
import routes from './routes/index.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(routes);
app.use(errorHandler);

const start = async () => {
  await connectDB(config.mongoUri);
  app.listen(config.port, () => {
    console.log(`atlas-dms running on port ${config.port}`);
  });
};

start();
