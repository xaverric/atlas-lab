import { Router } from 'express';
import { API_PREFIX } from '@atlas/core';
import healthRoutes from './health.js';
import endpointRoutes from './endpoint.js';
import dataRoutes from './data.js';
import publicRoutes from './public.js';

const router = Router();

router.use(healthRoutes);
router.use(`${API_PREFIX}/tracker/endpoints`, endpointRoutes);
router.use(`${API_PREFIX}/tracker/endpoints`, dataRoutes);
router.use(`${API_PREFIX}/tracker/public`, publicRoutes);

export default router;
