import { Router } from 'express';
import { API_PREFIX } from '@atlas/core';
import healthRoutes from './health.js';
import publicRoutes from './public.js';
import documentRoutes from './document.js';
import shareRoutes from './share.js';
import folderRoutes from './folder.js';

const router = Router();

router.use(healthRoutes);
router.use('/public', publicRoutes);

// Primary routes under /files
router.use(`${API_PREFIX}/files/documents`, documentRoutes);
router.use(`${API_PREFIX}/files/shares`, shareRoutes);
router.use(`${API_PREFIX}/files/folders`, folderRoutes);

// Backward-compat aliases under /dms
router.use(`${API_PREFIX}/dms/documents`, documentRoutes);
router.use(`${API_PREFIX}/dms/shares`, shareRoutes);
router.use(`${API_PREFIX}/dms/folders`, folderRoutes);

export default router;
