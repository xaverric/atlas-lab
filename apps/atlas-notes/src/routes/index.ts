import { Router } from 'express';
import { API_PREFIX } from '@atlas/core';
import healthRoutes from './health.js';
import noteRoutes from './note.js';
import searchRoutes from './search.js';
import folderRoutes from './folder.js';
import publicRoutes from './public.js';

const router = Router();

router.use(healthRoutes);
router.use('/public', publicRoutes);
router.use(`${API_PREFIX}/notes/search`, searchRoutes);
router.use(`${API_PREFIX}/notes/folders`, folderRoutes);
router.use(`${API_PREFIX}/notes`, noteRoutes);

export default router;
