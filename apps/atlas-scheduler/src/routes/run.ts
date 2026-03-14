import { Router } from 'express';
import { z } from 'zod';
import { validate } from '@atlas/server-common';
import { objectIdSchema } from '@atlas/core';
import { auth } from '../middleware/auth.js';
import * as runController from '../controllers/runController.js';

const router = Router();

const idParamSchema = z.object({ id: objectIdSchema });

router.use(auth);

router.get('/:id', validate(idParamSchema, 'params'), runController.getById);

export default router;
