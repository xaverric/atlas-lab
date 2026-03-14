import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import * as executionController from '../controllers/executionController.js';

const router = Router();

router.use(auth);
router.get('/', executionController.list);
router.get('/:id', executionController.getById);

export default router;
