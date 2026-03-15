import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import * as systemController from '../controllers/systemController.js';

const router = Router();

router.use(auth);
router.get('/storage', systemController.getStorageStats);

export default router;
