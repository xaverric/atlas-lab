import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import * as dataController from '../controllers/dataController.js';

const router = Router();

router.use(auth);
router.post('/:name/data', dataController.submit);
router.get('/:name/data', dataController.query);
router.delete('/:name/data/:id', dataController.deleteEntry);

export default router;
