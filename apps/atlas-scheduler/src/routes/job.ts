import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import * as jobController from '../controllers/jobController.js';

const router = Router();

router.use(auth);
router.post('/', jobController.create);
router.get('/', jobController.list);
router.get('/:id', jobController.getById);
router.patch('/:id', jobController.update);
router.delete('/:id', jobController.remove);
router.post('/:id/run', jobController.run);
router.patch('/:id/toggle', jobController.toggle);

export default router;
