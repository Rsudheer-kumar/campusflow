/**
 * CampusFlow API - Rule Administration Controllers
 * Exposes administrative HTTP handlers for AvailabilityRules, Blackouts, and Quotas.
 */

import { RuleAdminService } from '../services/ruleAdmin.service.js';
import { sendSuccess } from '../utils/response.js';

export class RuleAdminController {
  /* ==========================================================================
     AVAILABILITY RULES
     ========================================================================== */

  static async listAvailabilityRules(req, res, next) {
    try {
      const rules = await RuleAdminService.listAvailabilityRules(req.query);
      sendSuccess(res, { rules }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async getAvailabilityRuleById(req, res, next) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const rule = await RuleAdminService.getAvailabilityRuleById(id);
      sendSuccess(res, { rule }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async createAvailabilityRule(req, res, next) {
    try {
      const rule = await RuleAdminService.createAvailabilityRule(req.body);
      sendSuccess(res, { rule }, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateAvailabilityRule(req, res, next) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const rule = await RuleAdminService.updateAvailabilityRule(id, req.body);
      sendSuccess(res, { rule }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async deleteAvailabilityRule(req, res, next) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await RuleAdminService.deleteAvailabilityRule(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  /* ==========================================================================
     BLACKOUTS & HOLIDAYS
     ========================================================================== */

  static async listBlackouts(req, res, next) {
    try {
      const blackouts = await RuleAdminService.listBlackouts(req.query);
      sendSuccess(res, { blackouts }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async getBlackoutById(req, res, next) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const blackout = await RuleAdminService.getBlackoutById(id);
      sendSuccess(res, { blackout }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async createBlackout(req, res, next) {
    try {
      const blackout = await RuleAdminService.createBlackout(req.body);
      sendSuccess(res, { blackout }, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateBlackout(req, res, next) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const blackout = await RuleAdminService.updateBlackout(id, req.body);
      sendSuccess(res, { blackout }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async deleteBlackout(req, res, next) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await RuleAdminService.deleteBlackout(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  /* ==========================================================================
     QUOTAS
     ========================================================================== */

  static async listQuotas(req, res, next) {
    try {
      const quotas = await RuleAdminService.listQuotas(req.query);
      sendSuccess(res, { quotas }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async getQuotaById(req, res, next) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const quota = await RuleAdminService.getQuotaById(id);
      sendSuccess(res, { quota }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async createQuota(req, res, next) {
    try {
      const quota = await RuleAdminService.createQuota(req.body);
      sendSuccess(res, { quota }, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateQuota(req, res, next) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const quota = await RuleAdminService.updateQuota(id, req.body);
      sendSuccess(res, { quota }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async deleteQuota(req, res, next) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await RuleAdminService.deleteQuota(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
}
