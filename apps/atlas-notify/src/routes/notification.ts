import { Router } from 'express';
import { auth, internalAuth } from '../middleware/auth.js';
import * as notifyController from '../controllers/notifyController.js';
import * as preferenceController from '../controllers/preferenceController.js';
import * as templateController from '../controllers/templateController.js';

const router = Router();

router.post('/send', internalAuth, notifyController.send);

router.get('/', auth, notifyController.history);
router.get('/preferences', auth, preferenceController.get);
router.put('/preferences', auth, preferenceController.update);

router.get('/templates', auth, templateController.list);
router.post('/templates', auth, templateController.create);
router.patch('/templates/:id', auth, templateController.update);
router.delete('/templates/:id', auth, templateController.remove);

export default router;
