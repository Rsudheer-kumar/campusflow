/**
 * CampusFlow API - Resource Routes
 * Declares endpoints for facility and equipment catalogue discovery,
 * ResourceType metadata discovery, bulk CSV import, photo asset management,
 * and administrative resource lifecycle operations.
 */

import { Router } from 'express';
import { ResourceController } from '../controllers/resource.controller.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { validateMongoId } from '../validators/index.js';
import {
  validateResourceQuery,
  validateCreateResourceBody,
  validateUpdateResourceBody,
  validateToggleResourceStatusBody,
  validateBulkImportBody,
  validateAddPhotoBody,
} from '../validators/resource.validator.js';
import { UserRole } from '../models/user.model.js';

const router = Router();

// Resource discovery catalogue endpoints (accessible across authenticated/public roles)
router.get(
  '/',
  validateRequest({ query: validateResourceQuery }),
  ResourceController.listResources
);

// Resource types metadata endpoint (must precede /:id)
router.get('/types', ResourceController.listResourceTypes);

// Bulk CSV import endpoint (must precede /:id)
router.post(
  '/bulk-import',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({ body: validateBulkImportBody }),
  ResourceController.bulkImport
);

// Retrieve individual resource by ID
router.get(
  '/:id',
  validateRequest({ params: validateMongoId('id') }),
  ResourceController.getResourceById
);

// Administrative resource lifecycle endpoints (ADMIN, FACILITY_MANAGER)
router.post(
  '/',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({ body: validateCreateResourceBody }),
  ResourceController.createResource
);

router.put(
  '/:id',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({
    params: validateMongoId('id'),
    body: validateUpdateResourceBody,
  }),
  ResourceController.updateResource
);

router.patch(
  '/:id/status',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({
    params: validateMongoId('id'),
    body: validateToggleResourceStatusBody,
  }),
  ResourceController.toggleResourceStatus
);

router.delete(
  '/:id',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({ params: validateMongoId('id') }),
  ResourceController.archiveResource
);

// Photo asset management endpoints
router.post(
  '/:id/photos',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({
    params: validateMongoId('id'),
    body: validateAddPhotoBody,
  }),
  ResourceController.addPhoto
);

router.delete(
  '/:id/photos/:photoId',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({
    params: validateMongoId('id'),
  }),
  ResourceController.deletePhoto
);

router.put(
  '/:id/photos/:photoId/primary',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({
    params: validateMongoId('id'),
  }),
  ResourceController.setPrimaryPhoto
);

export default router;
