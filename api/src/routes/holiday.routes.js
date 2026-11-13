/**
 * CampusFlow API - Holiday Routes
 * Endpoints for public holiday listings and administrator holiday declarations.
 */

import { Router } from 'express';
import {
  listHolidays,
  declareCampusHoliday,
  revokeHoliday,
  syncPublicHolidays,
} from '../controllers/holiday.controller.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { UserRole } from '../models/user.model.js';

const holidayRoutes = Router();

// Public / Authenticated read-only list of holidays
holidayRoutes.get('/', listHolidays);

// Admin-only operations
holidayRoutes.post(
  '/declare',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  declareCampusHoliday
);

holidayRoutes.patch(
  '/:id/revoke',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  revokeHoliday
);

holidayRoutes.post(
  '/sync-public',
  authenticate,
  requireRoles(UserRole.ADMIN),
  syncPublicHolidays
);

export default holidayRoutes;
