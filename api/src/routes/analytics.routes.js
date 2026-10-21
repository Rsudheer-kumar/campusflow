/**
 * CampusFlow API - Analytics Routes
 * Exposes endpoints for facility utilization, status metrics, and activity reporting.
 */

import { Router } from 'express';
import { getAnalyticsOverview } from '../controllers/analytics.controller.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { UserRole } from '../models/user.model.js';

const router = Router();

/**
 * GET /api/analytics/overview
 * Requires authentication and administrative or departmental privilege.
 */
router.get(
  '/overview',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER, UserRole.DEPARTMENT_HEAD),
  getAnalyticsOverview
);

export default router;
