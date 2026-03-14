import { Router } from 'express';
import { API_PREFIX } from '@atlas/core';
import healthRoutes from './health.js';
import jobRoutes from './job.js';
import executionRoutes from './execution.js';

const router = Router();

router.use(healthRoutes);
router.use(`${API_PREFIX}/scheduler/jobs`, jobRoutes);
router.use(`${API_PREFIX}/scheduler/executions`, executionRoutes);

export default router;
