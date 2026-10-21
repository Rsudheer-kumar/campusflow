/**
 * CampusFlow API - Rule Administration Service
 * Provides business logic and transactional CRUD operations for:
 * 1. AvailabilityRules (operating hours, duration bounds, lead times)
 * 2. Blackouts (holidays, closures, special events)
 * 3. Quotas (departmental and role booking limits)
 */

import { Types } from 'mongoose';
import {
  AvailabilityRule,
  Blackout,
  Quota,
  Resource,
  ResourceType,
  User,
} from '../models/index.js';
import {
  NotFoundError,
  ConflictError,
} from '../utils/errors.js';

export class RuleAdminService {
  /* ==========================================================================
     AVAILABILITY RULES (Operating hours & Booking policies)
     ========================================================================== */

  static async listAvailabilityRules(filters = {}) {
    const query = {};
    if (filters.resource) {
      query.resource = new Types.ObjectId(filters.resource);
    }
    if (filters.isActive !== undefined) {
      query.isActive = Boolean(filters.isActive);
    }

    const rules = await AvailabilityRule.find(query)
      .populate('resource', 'name code location capacity')
      .sort({ createdAt: -1 })
      .lean();

    return rules;
  }

  static async getAvailabilityRuleById(id) {
    const rule = await AvailabilityRule.findById(id)
      .populate('resource', 'name code location capacity')
      .lean();

    if (!rule) {
      throw new NotFoundError(`AvailabilityRule with ID "${id}" not found`);
    }

    return rule;
  }

  static async createAvailabilityRule(input) {
    const resource = await Resource.findById(input.resource).lean();
    if (!resource) {
      throw new NotFoundError(`Resource with ID "${input.resource}" not found`);
    }

    const rule = new AvailabilityRule({
      resource: new Types.ObjectId(input.resource),
      name: input.name,
      timezone: input.timezone,
      windows: input.windows || [],
      bookingPolicy: input.bookingPolicy,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      isActive: input.isActive !== undefined ? input.isActive : true,
    });

    await rule.save();
    return await AvailabilityRule.findById(rule._id)
      .populate('resource', 'name code location capacity')
      .lean();
  }

  static async updateAvailabilityRule(id, input) {
    const rule = await AvailabilityRule.findById(id);
    if (!rule) {
      throw new NotFoundError(`AvailabilityRule with ID "${id}" not found`);
    }

    if (input.name !== undefined) rule.name = input.name;
    if (input.timezone !== undefined) rule.timezone = input.timezone;
    if (input.windows !== undefined) rule.windows = input.windows;
    if (input.bookingPolicy !== undefined) rule.bookingPolicy = input.bookingPolicy;
    if (input.effectiveFrom !== undefined) rule.effectiveFrom = input.effectiveFrom;
    if (input.effectiveTo !== undefined) rule.effectiveTo = input.effectiveTo;
    if (input.isActive !== undefined) rule.isActive = input.isActive;

    await rule.save();
    return await AvailabilityRule.findById(rule._id)
      .populate('resource', 'name code location capacity')
      .lean();
  }

  static async deleteAvailabilityRule(id) {
    const rule = await AvailabilityRule.findById(id);
    if (!rule) {
      throw new NotFoundError(`AvailabilityRule with ID "${id}" not found`);
    }

    rule.isActive = false;
    await rule.save();
    return { success: true, message: 'Availability rule deactivated successfully' };
  }

  /* ==========================================================================
     BLACKOUTS & HOLIDAYS (Blocked intervals)
     ========================================================================== */

  static async listBlackouts(filters = {}) {
    const query = {};
    if (filters.resource) {
      query.resource = new Types.ObjectId(filters.resource);
    }
    if (filters.category) {
      query.category = filters.category;
    }
    if (filters.isActive !== undefined) {
      query.isActive = Boolean(filters.isActive);
    }

    const blackouts = await Blackout.find(query)
      .populate('resource', 'name code location')
      .sort({ startAt: 1 })
      .lean();

    return blackouts;
  }

  static async getBlackoutById(id) {
    const blackout = await Blackout.findById(id)
      .populate('resource', 'name code location')
      .lean();

    if (!blackout) {
      throw new NotFoundError(`Blackout with ID "${id}" not found`);
    }

    return blackout;
  }

  static async createBlackout(input) {
    const resource = await Resource.findById(input.resource).lean();
    if (!resource) {
      throw new NotFoundError(`Resource with ID "${input.resource}" not found`);
    }

    // Check for exact identical blackout
    const existingExact = await Blackout.findOne({
      resource: new Types.ObjectId(input.resource),
      startAt: input.startAt,
      endAt: input.endAt,
      isActive: true,
    }).lean();

    if (existingExact) {
      throw new ConflictError(`An active blackout already exists for this exact time interval: "${existingExact.reason}"`);
    }

    const blackout = new Blackout({
      resource: new Types.ObjectId(input.resource),
      startAt: input.startAt,
      endAt: input.endAt,
      reason: input.reason,
      category: input.category,
      description: input.description,
      isActive: input.isActive !== undefined ? input.isActive : true,
    });

    await blackout.save();
    return await Blackout.findById(blackout._id)
      .populate('resource', 'name code location')
      .lean();
  }

  static async updateBlackout(id, input) {
    const blackout = await Blackout.findById(id);
    if (!blackout) {
      throw new NotFoundError(`Blackout with ID "${id}" not found`);
    }

    if (input.startAt !== undefined) blackout.startAt = input.startAt;
    if (input.endAt !== undefined) blackout.endAt = input.endAt;
    if (input.reason !== undefined) blackout.reason = input.reason;
    if (input.category !== undefined) blackout.category = input.category;
    if (input.description !== undefined) blackout.description = input.description;
    if (input.isActive !== undefined) blackout.isActive = input.isActive;

    await blackout.save();
    return await Blackout.findById(blackout._id)
      .populate('resource', 'name code location')
      .lean();
  }

  static async deleteBlackout(id) {
    const blackout = await Blackout.findById(id);
    if (!blackout) {
      throw new NotFoundError(`Blackout with ID "${id}" not found`);
    }

    blackout.isActive = false;
    await blackout.save();
    return { success: true, message: 'Blackout deactivated successfully' };
  }

  /* ==========================================================================
     QUOTAS (Departmental & Role booking limits)
     ========================================================================== */

  static async listQuotas(filters = {}) {
    const query = {};
    if (filters.subjectType) {
      query.subjectType = filters.subjectType;
    }
    if (filters.role) {
      query.role = filters.role;
    }
    if (filters.department) {
      query.department = { $regex: filters.department, $options: 'i' };
    }
    if (filters.scopeType) {
      query.scopeType = filters.scopeType;
    }
    if (filters.resource) {
      query.resource = new Types.ObjectId(filters.resource);
    }
    if (filters.resourceType) {
      query.resourceType = new Types.ObjectId(filters.resourceType);
    }
    if (filters.isActive !== undefined) {
      query.isActive = Boolean(filters.isActive);
    }

    const quotas = await Quota.find(query)
      .populate('resource', 'name code location')
      .populate('resourceType', 'name code category')
      .populate('user', 'firstName lastName email department')
      .sort({ createdAt: -1 })
      .lean();

    return quotas;
  }

  static async getQuotaById(id) {
    const quota = await Quota.findById(id)
      .populate('resource', 'name code location')
      .populate('resourceType', 'name code category')
      .populate('user', 'firstName lastName email department')
      .lean();

    if (!quota) {
      throw new NotFoundError(`Quota with ID "${id}" not found`);
    }

    return quota;
  }

  static async createQuota(input) {
    // Verify scope target existence
    if (input.scopeType === 'RESOURCE') {
      const resource = await Resource.findById(input.resource).lean();
      if (!resource) {
        throw new NotFoundError(`Resource with ID "${input.resource}" not found`);
      }
    } else if (input.scopeType === 'RESOURCE_TYPE') {
      const type = await ResourceType.findById(input.resourceType).lean();
      if (!type) {
        throw new NotFoundError(`ResourceType with ID "${input.resourceType}" not found`);
      }
    }

    // Verify subject existence if USER
    if (input.subjectType === 'USER') {
      const user = await User.findById(input.user).lean();
      if (!user) {
        throw new NotFoundError(`User with ID "${input.user}" not found`);
      }
    }

    const quota = new Quota({
      name: input.name,
      scopeType: input.scopeType,
      resource: input.resource ? new Types.ObjectId(input.resource) : undefined,
      resourceType: input.resourceType ? new Types.ObjectId(input.resourceType) : undefined,
      subjectType: input.subjectType,
      user: input.user ? new Types.ObjectId(input.user) : undefined,
      role: input.role,
      department: input.department,
      metric: input.metric,
      period: input.period,
      limit: input.limit,
      timezone: input.timezone,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      isActive: input.isActive !== undefined ? input.isActive : true,
    });

    try {
      await quota.save();
      return await Quota.findById(quota._id)
        .populate('resource', 'name code location')
        .populate('resourceType', 'name code category')
        .populate('user', 'firstName lastName email department')
        .lean();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new ConflictError('A quota policy with these identical scope, subject, and time parameters already exists');
      }
      throw error;
    }
  }

  static async updateQuota(id, input) {
    const quota = await Quota.findById(id);
    if (!quota) {
      throw new NotFoundError(`Quota with ID "${id}" not found`);
    }

    if (input.name !== undefined) quota.name = input.name;
    if (input.limit !== undefined) quota.limit = input.limit;
    if (input.timezone !== undefined) quota.timezone = input.timezone;
    if (input.department !== undefined) quota.department = input.department;
    if (input.effectiveFrom !== undefined) quota.effectiveFrom = input.effectiveFrom;
    if (input.effectiveTo !== undefined) quota.effectiveTo = input.effectiveTo;
    if (input.isActive !== undefined) quota.isActive = input.isActive;

    try {
      await quota.save();
      return await Quota.findById(quota._id)
        .populate('resource', 'name code location')
        .populate('resourceType', 'name code category')
        .populate('user', 'firstName lastName email department')
        .lean();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new ConflictError('A quota policy with these parameters already exists');
      }
      throw error;
    }
  }

  static async deleteQuota(id) {
    const quota = await Quota.findById(id);
    if (!quota) {
      throw new NotFoundError(`Quota with ID "${id}" not found`);
    }

    quota.isActive = false;
    await quota.save();
    return { success: true, message: 'Quota deactivated successfully' };
  }
}
