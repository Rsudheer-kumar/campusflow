/**
 * CampusFlow API - Approvals Queue Routes
 * Route declarations for pending approvals queue.
 */

import { Router } from 'express';
import { getPendingApprovals } from '../controllers/approvalQueue.controller.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { validatePendingApprovalsQuery } from '../validators/booking.validator.js';
import { UserRole } from '../models/user.model.js';

const router = Router();

router.get(
  '/pending',
  authenticate,
  requireRoles(UserRole.DEPARTMENT_HEAD, UserRole.FACILITY_MANAGER, UserRole.ADMIN),
  validateRequest({ query: validatePendingApprovalsQuery }),
  getPendingApprovals
);

export default router;
