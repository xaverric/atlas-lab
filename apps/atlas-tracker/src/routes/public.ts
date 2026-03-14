import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import * as dataController from '../controllers/dataController.js';

const router = Router();

const publicLimiter = rateLimit({
  windowMs: config.publicRateLimit.windowMs,
  max: config.publicRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

router.use(publicLimiter);
router.get('/:name', dataController.getPublicEndpoint);
router.post('/:name/data', dataController.submitPublic);
router.get('/:name/data', dataController.queryPublic);

export default router;
