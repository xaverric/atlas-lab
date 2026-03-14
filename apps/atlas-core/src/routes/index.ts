import { Router } from 'express';
import { API_PREFIX } from '@atlas/core';
import healthRoutes from './health.js';
import userRoutes from './user.js';
import auditRoutes from './audit.js';

const router = Router();

router.use(healthRoutes);
router.use(`${API_PREFIX}/users`, userRoutes);
router.use(`${API_PREFIX}/audit`, auditRoutes);

export default router;
