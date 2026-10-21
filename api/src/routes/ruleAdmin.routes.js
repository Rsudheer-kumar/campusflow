/**
 * CampusFlow API - Rule Administration Routes
 * Declares administrative endpoints for AvailabilityRules, Blackouts, and Quotas.
 */

import { Router } from 'express';
import { RuleAdminController } from '../controllers/ruleAdmin.controller.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { validateMongoId } from '../validators/index.js';
import {
  validateCreateAvailabilityRuleBody,
  validateUpdateAvailabilityRuleBody,
  validateCreateBlackoutBody,
  validateUpdateBlackoutBody,
  validateCreateQuotaBody,
  validateUpdateQuotaBody,
} from '../validators/ruleAdmin.validator.js';
import { UserRole } from '../models/user.model.js';

/* ==========================================================================
   AVAILABILITY RULES ROUTER (/api/availability-rules)
   ========================================================================== */
export const availabilityRuleRouter = Router();

// List rules
availabilityRuleRouter.get(
  '/',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  RuleAdminController.listAvailabilityRules
);

// Get rule by ID
availabilityRuleRouter.get(
  '/:id',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({ params: validateMongoId('id') }),
  RuleAdminController.getAvailabilityRuleById
);

// Create rule
availabilityRuleRouter.post(
  '/',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({ body: validateCreateAvailabilityRuleBody }),
  RuleAdminController.createAvailabilityRule
);

// Update rule
availabilityRuleRouter.put(
  '/:id',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({
    params: validateMongoId('id'),
    body: validateUpdateAvailabilityRuleBody,
  }),
  RuleAdminController.updateAvailabilityRule
);

// Deactivate rule
availabilityRuleRouter.delete(
  '/:id',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({ params: validateMongoId('id') }),
  RuleAdminController.deleteAvailabilityRule
);

/* ==========================================================================
   BLACKOUTS ROUTER (/api/blackouts)
   ========================================================================== */
export const blackoutRouter = Router();

// List blackouts
blackoutRouter.get(
  '/',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  RuleAdminController.listBlackouts
);

// Get blackout by ID
blackoutRouter.get(
  '/:id',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({ params: validateMongoId('id') }),
  RuleAdminController.getBlackoutById
);

// Create blackout
blackoutRouter.post(
  '/',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({ body: validateCreateBlackoutBody }),
  RuleAdminController.createBlackout
);

// Update blackout
blackoutRouter.put(
  '/:id',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({
    params: validateMongoId('id'),
    body: validateUpdateBlackoutBody,
  }),
  RuleAdminController.updateBlackout
);

// Deactivate blackout
blackoutRouter.delete(
  '/:id',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({ params: validateMongoId('id') }),
  RuleAdminController.deleteBlackout
);

/* ==========================================================================
   QUOTAS ROUTER (/api/quotas)
   ========================================================================== */
export const quotaRouter = Router();

// List quotas
quotaRouter.get(
  '/',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  RuleAdminController.listQuotas
);

// Get quota by ID
quotaRouter.get(
  '/:id',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({ params: validateMongoId('id') }),
  RuleAdminController.getQuotaById
);

// Create quota
quotaRouter.post(
  '/',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({ body: validateCreateQuotaBody }),
  RuleAdminController.createQuota
);

// Update quota
quotaRouter.put(
  '/:id',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({
    params: validateMongoId('id'),
    body: validateUpdateQuotaBody,
  }),
  RuleAdminController.updateQuota
);

// Deactivate quota
quotaRouter.delete(
  '/:id',
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER),
  validateRequest({ params: validateMongoId('id') }),
  RuleAdminController.deleteQuota
);
