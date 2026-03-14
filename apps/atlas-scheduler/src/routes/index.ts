import { Router } from 'express';
import { API_PREFIX } from '@atlas/core';
import healthRoutes from './health.js';
import jobRoutes from './job.js';
import runRoutes from './run.js';

const router = Router();

router.use(healthRoutes);
router.use(`${API_PREFIX}/scheduler/jobs`, jobRoutes);
router.use(`${API_PREFIX}/scheduler/runs`, runRoutes);

export default router;
