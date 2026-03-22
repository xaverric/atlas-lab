import { createPublishNotification } from '@atlas/server-common';
import { config } from '../config/index.js';

export const publishNotification = createPublishNotification(config.notifyUrl, config.internalKey);
