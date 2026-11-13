/**
 * CampusFlow API - Emergency Booking Routes
 * Endpoints for Department Head cascade room searches and administrative emergency actions.
 */

import { Router } from 'express';
import {
  searchCascade,
  submitEmergencyRequest,
  actionEmergencyRequest,
} from '../controllers/emergencyBooking.controller.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { UserRole } from '../models/user.model.js';

const emergencyBookingRoutes = Router();

// HOD & Admin cascade search across Blocks D -> A -> B -> C
emergencyBookingRoutes.get(
  '/search',
  authenticate,
  requireRoles(UserRole.DEPARTMENT_HEAD, UserRole.ADMIN, UserRole.FACULTY),
  searchCascade
);

// HOD emergency meeting escalation request
emergencyBookingRoutes.post(
  '/request',
  authenticate,
  requireRoles(UserRole.DEPARTMENT_HEAD, UserRole.ADMIN),
  submitEmergencyRequest
);

// Admin action (Approve / Reject) with relocation audit
emergencyBookingRoutes.post(
  '/:id/action',
  authenticate,
  requireRoles(UserRole.ADMIN),
  actionEmergencyRequest
);

export default emergencyBookingRoutes;
