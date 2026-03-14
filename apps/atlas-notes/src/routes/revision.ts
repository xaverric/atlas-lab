import { Router } from 'express';
import { z } from 'zod';
import { validate } from '@atlas/server-common';
import { objectIdSchema, paginationSchema } from '@atlas/core';
import * as revisionController from '../controllers/revisionController.js';

const router = Router({ mergeParams: true });

const revIdParamSchema = z.object({ id: objectIdSchema, revId: objectIdSchema });
const listQuerySchema = paginationSchema;

router.get('/', validate(listQuerySchema, 'query'), revisionController.list);
router.get('/:revId', validate(revIdParamSchema, 'params'), revisionController.getById);
router.post('/:revId/restore', validate(revIdParamSchema, 'params'), revisionController.restore);

export default router;
