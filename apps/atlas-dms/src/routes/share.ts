import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import * as shareController from '../controllers/shareController.js';

const router = Router();

router.post('/', auth, shareController.create);
router.get('/:token', shareController.resolve);
router.delete('/:id', auth, shareController.revoke);

export default router;
