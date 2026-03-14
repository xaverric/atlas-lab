import { Router } from 'express';
import { API_PREFIX } from '@atlas/core';
import healthRoutes from './health.js';
import userRoutes from './user.js';

const router = Router();

router.use(healthRoutes);
router.use(`${API_PREFIX}/users`, userRoutes);

export default router;
