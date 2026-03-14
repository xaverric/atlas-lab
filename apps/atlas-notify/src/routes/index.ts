import { Router } from 'express';
import { API_PREFIX } from '@atlas/core';
import healthRoutes from './health.js';
import notificationRoutes from './notification.js';

const router = Router();

router.use(healthRoutes);
router.use(`${API_PREFIX}/notifications`, notificationRoutes);

export default router;
