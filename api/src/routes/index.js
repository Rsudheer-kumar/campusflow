/**
 * CampusFlow API - Main API Router
 * Aggregates all route modules under the /api prefix.
 * Future domain routes will be registered here as separate routers.
 */

import { Router } from 'express';
import healthRoutes from './health.routes.js';
import bookingRoutes from './booking.routes.js';
import authRoutes from './auth.routes.js';
import timetableRoutes from './timetable.routes.js';
import resourceRoutes from './resource.routes.js';
import approvalRoutes from './approval.routes.js';
import approvalPolicyRoutes from './approvalPolicy.routes.js';

const router = Router();

// Authentication endpoints: /api/auth
router.use('/auth', authRoutes);

// Health & diagnostics endpoint: /api/health
router.use('/health', healthRoutes);

// Facility & resource catalogue endpoints: /api/resources
router.use('/resources', resourceRoutes);

// Booking engine endpoints: /api/bookings
router.use('/bookings', bookingRoutes);

// Timetable integration endpoints: /api/timetables (Phase 3.1)
router.use('/timetables', timetableRoutes);

// Approvals queue endpoints: /api/approvals (Phase 3.2)
router.use('/approvals', approvalRoutes);

// Approval policy administration endpoints: /api/approval-policies (Phase 3.2)
router.use('/approval-policies', approvalPolicyRoutes);

export default router;
