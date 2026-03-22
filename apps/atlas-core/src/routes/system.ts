import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '@atlas/server-common';
import * as systemController from '../controllers/systemController.js';

const router = Router();

router.use(auth);
router.use(requireRole('admin'));
router.get('/resources', systemController.getSystemResources);
router.get('/storage', systemController.getStorageStats);
router.get('/storage/:section', systemController.getStorageDetail);

export default router;
