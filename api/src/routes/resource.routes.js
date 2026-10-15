/**
 * CampusFlow API - Resource Routes
 * Declares endpoints for facility and equipment catalogue discovery.
 */

import { Router } from 'express';
import { ResourceController } from '../controllers/resource.controller.js';
import { validateRequest } from '../middleware/validate.js';
import { validateMongoId } from '../validators/index.js';
import { validateResourceQuery } from '../validators/resource.validator.js';

const router = Router();

// Resource discovery catalogue endpoints (accessible publicly / across authenticated roles)
router.get(
  '/',
  validateRequest({ query: validateResourceQuery }),
  ResourceController.listResources
);

router.get(
  '/:id',
  validateRequest({ params: validateMongoId('id') }),
  ResourceController.getResourceById
);

export default router;
