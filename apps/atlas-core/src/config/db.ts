import { connectDB as connect } from '@atlas/server-common';
import { config } from './index.js';

export const connectDB = () => connect(config.mongoUri);
