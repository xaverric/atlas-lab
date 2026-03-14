import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { connectDB } from './config/db.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(routes);
app.use(errorHandler);

const start = async () => {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`atlas-core running on port ${config.port}`);
  });
};

start();
