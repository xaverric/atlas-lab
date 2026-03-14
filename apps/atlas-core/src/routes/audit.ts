import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '@atlas/server-common';
import * as auditController from '../controllers/auditController.js';

const router = Router();

router.use(auth);
router.use(requireRole('admin'));
router.get('/events', auditController.getEvents);

export default router;
