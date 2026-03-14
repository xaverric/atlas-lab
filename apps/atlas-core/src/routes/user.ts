import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as userController from '../controllers/userController.js';

const router = Router();

const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
});

router.use(auth);
router.get('/me', userController.getMe);
router.patch('/me/preferences', validate(updatePreferencesSchema), userController.updatePreferences);

export default router;
