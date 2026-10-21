/**
 * CampusFlow API - Rule Administration Validators
 * Validates payloads for AvailabilityRules, Blackouts, and Quotas.
 */

import { DayOfWeek, isValidIanaTimezone } from '../models/availabilityRule.model.js';
import { BlackoutCategory } from '../models/blackout.model.js';
import { QuotaScopeType, QuotaSubjectType, QuotaMetric, QuotaPeriod } from '../models/quota.model.js';
import { UserRole } from '../models/user.model.js';
import { isValidCalendarDate, timeStringToMinutes, normalizeDepartmentName } from '../utils/dateValidation.js';

const hex24Regex = /^[0-9a-fA-F]{24}$/;
const startTimeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const endTimeRegex = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

/**
 * Validates availability window array:
 * Each window must have valid dayOfWeek, startTime (00:00-23:59), endTime (00:00-24:00),
 * and startTime < endTime.
 */
function validateWindows(windows) {
  const errors = [];
  if (!Array.isArray(windows)) {
    errors.push({ field: 'windows', message: 'windows must be an array' });
    return { errors, data: [] };
  }

  const validated = [];
  const validDays = Object.values(DayOfWeek);

  windows.forEach((win, idx) => {
    const prefix = `windows[${idx}]`;
    if (!win || typeof win !== 'object') {
      errors.push({ field: prefix, message: 'Window must be an object' });
      return;
    }

    if (!win.dayOfWeek || !validDays.includes(win.dayOfWeek)) {
      errors.push({
        field: `${prefix}.dayOfWeek`,
        message: `dayOfWeek must be one of: ${validDays.join(', ')}`,
      });
    }

    let startValid = false;
    if (!win.startTime || typeof win.startTime !== 'string' || !startTimeRegex.test(win.startTime.trim())) {
      errors.push({
        field: `${prefix}.startTime`,
        message: 'startTime must be in strict 24-hour HH:mm format between 00:00 and 23:59',
      });
    } else {
      startValid = true;
    }

    let endValid = false;
    if (!win.endTime || typeof win.endTime !== 'string' || !endTimeRegex.test(win.endTime.trim())) {
      errors.push({
        field: `${prefix}.endTime`,
        message: 'endTime must be in strict 24-hour HH:mm format between 00:00 and 24:00',
      });
    } else {
      endValid = true;
    }

    if (startValid && endValid) {
      const startMin = timeStringToMinutes(win.startTime.trim());
      const endMin = timeStringToMinutes(win.endTime.trim());
      if (startMin >= endMin) {
        errors.push({
          field: prefix,
          message: `startTime (${win.startTime}) must be earlier than endTime (${win.endTime})`,
        });
      }
    }

    validated.push({
      dayOfWeek: win.dayOfWeek,
      startTime: (win.startTime || '').trim(),
      endTime: (win.endTime || '').trim(),
    });
  });

  return { errors, data: validated };
}

/**
 * Validates booking policy subdocument
 */
function validateBookingPolicy(policy, isUpdate = false) {
  const errors = [];
  if (!policy || typeof policy !== 'object') {
    if (!isUpdate) {
      errors.push({ field: 'bookingPolicy', message: 'bookingPolicy is required' });
    }
    return { errors, data: undefined };
  }

  const validated = {};

  if (policy.minDurationMinutes !== undefined) {
    const minDur = Number(policy.minDurationMinutes);
    if (!Number.isInteger(minDur) || minDur <= 0) {
      errors.push({ field: 'bookingPolicy.minDurationMinutes', message: 'minDurationMinutes must be a positive integer' });
    } else {
      validated.minDurationMinutes = minDur;
    }
  } else if (!isUpdate) {
    errors.push({ field: 'bookingPolicy.minDurationMinutes', message: 'minDurationMinutes is required' });
  }

  if (policy.maxDurationMinutes !== undefined) {
    const maxDur = Number(policy.maxDurationMinutes);
    if (!Number.isInteger(maxDur) || maxDur <= 0) {
      errors.push({ field: 'bookingPolicy.maxDurationMinutes', message: 'maxDurationMinutes must be a positive integer' });
    } else {
      validated.maxDurationMinutes = maxDur;
    }
  } else if (!isUpdate) {
    errors.push({ field: 'bookingPolicy.maxDurationMinutes', message: 'maxDurationMinutes is required' });
  }

  if (validated.minDurationMinutes && validated.maxDurationMinutes && validated.minDurationMinutes > validated.maxDurationMinutes) {
    errors.push({
      field: 'bookingPolicy',
      message: `minDurationMinutes (${validated.minDurationMinutes}) cannot exceed maxDurationMinutes (${validated.maxDurationMinutes})`,
    });
  }

  if (policy.minLeadTimeMinutes !== undefined) {
    const minLead = Number(policy.minLeadTimeMinutes);
    if (!Number.isInteger(minLead) || minLead < 0) {
      errors.push({ field: 'bookingPolicy.minLeadTimeMinutes', message: 'minLeadTimeMinutes must be a non-negative integer' });
    } else {
      validated.minLeadTimeMinutes = minLead;
    }
  } else if (!isUpdate) {
    validated.minLeadTimeMinutes = 0;
  }

  if (policy.maxAdvanceBookingDays !== undefined) {
    const maxAdv = Number(policy.maxAdvanceBookingDays);
    if (!Number.isInteger(maxAdv) || maxAdv < 0) {
      errors.push({ field: 'bookingPolicy.maxAdvanceBookingDays', message: 'maxAdvanceBookingDays must be a non-negative integer' });
    } else {
      validated.maxAdvanceBookingDays = maxAdv;
    }
  } else if (!isUpdate) {
    validated.maxAdvanceBookingDays = 30;
  }

  return { errors, data: validated };
}

export function validateCreateAvailabilityRuleBody(data) {
  const record = data || {};
  const errors = [];

  // resource
  let resource;
  if (!record.resource || typeof record.resource !== 'string' || !hex24Regex.test(record.resource)) {
    errors.push({ field: 'resource', message: 'resource must be a valid 24-character hexadecimal ObjectId' });
  } else {
    resource = record.resource;
  }

  // name
  let name;
  if (!record.name || typeof record.name !== 'string') {
    errors.push({ field: 'name', message: 'Availability rule name is required' });
  } else {
    name = record.name.trim();
    if (name.length < 2 || name.length > 100) {
      errors.push({ field: 'name', message: 'Name must be between 2 and 100 characters' });
    }
  }

  // timezone
  let timezone;
  if (!record.timezone || typeof record.timezone !== 'string' || !isValidIanaTimezone(record.timezone.trim())) {
    errors.push({ field: 'timezone', message: 'Valid IANA timezone identifier is required (e.g., "Asia/Kolkata", "UTC")' });
  } else {
    timezone = record.timezone.trim();
  }

  // windows
  const winRes = validateWindows(record.windows || []);
  if (winRes.errors.length > 0) {
    errors.push(...winRes.errors);
  }

  // bookingPolicy
  const policyRes = validateBookingPolicy(record.bookingPolicy, false);
  if (policyRes.errors.length > 0) {
    errors.push(...policyRes.errors);
  }

  // effectiveFrom & effectiveTo
  let effectiveFrom;
  if (record.effectiveFrom) {
    if (!isValidCalendarDate(record.effectiveFrom)) {
      errors.push({ field: 'effectiveFrom', message: 'effectiveFrom must be a valid YYYY-MM-DD date' });
    } else {
      effectiveFrom = record.effectiveFrom;
    }
  }

  let effectiveTo;
  if (record.effectiveTo) {
    if (!isValidCalendarDate(record.effectiveTo)) {
      errors.push({ field: 'effectiveTo', message: 'effectiveTo must be a valid YYYY-MM-DD date' });
    } else {
      effectiveTo = record.effectiveTo;
    }
  }

  if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) {
    errors.push({ field: 'effectiveFrom', message: `effectiveFrom (${effectiveFrom}) cannot be later than effectiveTo (${effectiveTo})` });
  }

  const isActive = record.isActive !== undefined ? Boolean(record.isActive) : true;

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      resource,
      name,
      timezone,
      windows: winRes.data,
      bookingPolicy: policyRes.data,
      effectiveFrom,
      effectiveTo,
      isActive,
    },
  };
}

export function validateUpdateAvailabilityRuleBody(data) {
  const record = data || {};
  const errors = [];
  const validated = {};

  if (record.name !== undefined) {
    if (typeof record.name !== 'string') {
      errors.push({ field: 'name', message: 'Name must be a string' });
    } else {
      const name = record.name.trim();
      if (name.length < 2 || name.length > 100) {
        errors.push({ field: 'name', message: 'Name must be between 2 and 100 characters' });
      } else {
        validated.name = name;
      }
    }
  }

  if (record.timezone !== undefined) {
    if (typeof record.timezone !== 'string' || !isValidIanaTimezone(record.timezone.trim())) {
      errors.push({ field: 'timezone', message: 'Valid IANA timezone identifier is required' });
    } else {
      validated.timezone = record.timezone.trim();
    }
  }

  if (record.windows !== undefined) {
    const winRes = validateWindows(record.windows);
    if (winRes.errors.length > 0) {
      errors.push(...winRes.errors);
    } else {
      validated.windows = winRes.data;
    }
  }

  if (record.bookingPolicy !== undefined) {
    const polRes = validateBookingPolicy(record.bookingPolicy, true);
    if (polRes.errors.length > 0) {
      errors.push(...polRes.errors);
    } else {
      validated.bookingPolicy = polRes.data;
    }
  }

  if (record.effectiveFrom !== undefined) {
    if (record.effectiveFrom && !isValidCalendarDate(record.effectiveFrom)) {
      errors.push({ field: 'effectiveFrom', message: 'effectiveFrom must be a valid YYYY-MM-DD date' });
    } else {
      validated.effectiveFrom = record.effectiveFrom || null;
    }
  }

  if (record.effectiveTo !== undefined) {
    if (record.effectiveTo && !isValidCalendarDate(record.effectiveTo)) {
      errors.push({ field: 'effectiveTo', message: 'effectiveTo must be a valid YYYY-MM-DD date' });
    } else {
      validated.effectiveTo = record.effectiveTo || null;
    }
  }

  if (validated.effectiveFrom && validated.effectiveTo && validated.effectiveFrom > validated.effectiveTo) {
    errors.push({ field: 'effectiveFrom', message: 'effectiveFrom cannot be later than effectiveTo' });
  }

  if (record.isActive !== undefined) {
    validated.isActive = Boolean(record.isActive);
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: validated };
}

export function validateCreateBlackoutBody(data) {
  const record = data || {};
  const errors = [];

  let resource;
  if (!record.resource || typeof record.resource !== 'string' || !hex24Regex.test(record.resource)) {
    errors.push({ field: 'resource', message: 'resource must be a valid 24-character hexadecimal ObjectId' });
  } else {
    resource = record.resource;
  }

  let startAt;
  if (!record.startAt) {
    errors.push({ field: 'startAt', message: 'startAt timestamp is required' });
  } else {
    const d = new Date(record.startAt);
    if (isNaN(d.getTime())) {
      errors.push({ field: 'startAt', message: 'startAt must be a valid ISO 8601 Date string' });
    } else {
      startAt = d;
    }
  }

  let endAt;
  if (!record.endAt) {
    errors.push({ field: 'endAt', message: 'endAt timestamp is required' });
  } else {
    const d = new Date(record.endAt);
    if (isNaN(d.getTime())) {
      errors.push({ field: 'endAt', message: 'endAt must be a valid ISO 8601 Date string' });
    } else {
      endAt = d;
    }
  }

  if (startAt && endAt && startAt.getTime() >= endAt.getTime()) {
    errors.push({ field: 'startAt', message: 'Blackout startAt must be earlier than endAt' });
  }

  let reason;
  if (!record.reason || typeof record.reason !== 'string') {
    errors.push({ field: 'reason', message: 'Blackout reason is required' });
  } else {
    reason = record.reason.trim();
    if (reason.length < 2 || reason.length > 500) {
      errors.push({ field: 'reason', message: 'Reason must be between 2 and 500 characters' });
    }
  }

  let category = BlackoutCategory.ADMINISTRATIVE;
  if (record.category !== undefined) {
    const validCats = Object.values(BlackoutCategory);
    if (!validCats.includes(record.category)) {
      errors.push({ field: 'category', message: `category must be one of: ${validCats.join(', ')}` });
    } else {
      category = record.category;
    }
  }

  let description = '';
  if (record.description) {
    if (typeof record.description !== 'string') {
      errors.push({ field: 'description', message: 'description must be a string' });
    } else {
      description = record.description.trim();
      if (description.length > 1000) {
        errors.push({ field: 'description', message: 'description cannot exceed 1000 characters' });
      }
    }
  }

  const isActive = record.isActive !== undefined ? Boolean(record.isActive) : true;

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      resource,
      startAt,
      endAt,
      reason,
      category,
      description,
      isActive,
    },
  };
}

export function validateUpdateBlackoutBody(data) {
  const record = data || {};
  const errors = [];
  const validated = {};

  if (record.startAt !== undefined) {
    const d = new Date(record.startAt);
    if (isNaN(d.getTime())) {
      errors.push({ field: 'startAt', message: 'startAt must be a valid Date string' });
    } else {
      validated.startAt = d;
    }
  }

  if (record.endAt !== undefined) {
    const d = new Date(record.endAt);
    if (isNaN(d.getTime())) {
      errors.push({ field: 'endAt', message: 'endAt must be a valid Date string' });
    } else {
      validated.endAt = d;
    }
  }

  if (validated.startAt && validated.endAt && validated.startAt.getTime() >= validated.endAt.getTime()) {
    errors.push({ field: 'startAt', message: 'startAt must be earlier than endAt' });
  }

  if (record.reason !== undefined) {
    if (typeof record.reason !== 'string' || record.reason.trim().length < 2) {
      errors.push({ field: 'reason', message: 'Reason must be at least 2 characters' });
    } else {
      validated.reason = record.reason.trim();
    }
  }

  if (record.category !== undefined) {
    const validCats = Object.values(BlackoutCategory);
    if (!validCats.includes(record.category)) {
      errors.push({ field: 'category', message: `category must be one of: ${validCats.join(', ')}` });
    } else {
      validated.category = record.category;
    }
  }

  if (record.description !== undefined) {
    validated.description = typeof record.description === 'string' ? record.description.trim() : '';
  }

  if (record.isActive !== undefined) {
    validated.isActive = Boolean(record.isActive);
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: validated };
}

export function validateCreateQuotaBody(data) {
  const record = data || {};
  const errors = [];

  let name;
  if (!record.name || typeof record.name !== 'string') {
    errors.push({ field: 'name', message: 'Quota name is required' });
  } else {
    name = record.name.trim();
    if (name.length < 2 || name.length > 100) {
      errors.push({ field: 'name', message: 'Name must be between 2 and 100 characters' });
    }
  }

  let scopeType;
  const validScopes = Object.values(QuotaScopeType);
  if (!record.scopeType || !validScopes.includes(record.scopeType)) {
    errors.push({ field: 'scopeType', message: `scopeType must be one of: ${validScopes.join(', ')}` });
  } else {
    scopeType = record.scopeType;
  }

  let resource;
  let resourceType;
  if (scopeType === QuotaScopeType.RESOURCE) {
    if (!record.resource || !hex24Regex.test(record.resource)) {
      errors.push({ field: 'resource', message: 'resource reference ObjectId is required for scopeType RESOURCE' });
    } else {
      resource = record.resource;
    }
  } else if (scopeType === QuotaScopeType.RESOURCE_TYPE) {
    if (!record.resourceType || !hex24Regex.test(record.resourceType)) {
      errors.push({ field: 'resourceType', message: 'resourceType reference ObjectId is required for scopeType RESOURCE_TYPE' });
    } else {
      resourceType = record.resourceType;
    }
  }

  let subjectType;
  const validSubjects = Object.values(QuotaSubjectType);
  if (!record.subjectType || !validSubjects.includes(record.subjectType)) {
    errors.push({ field: 'subjectType', message: `subjectType must be one of: ${validSubjects.join(', ')}` });
  } else {
    subjectType = record.subjectType;
  }

  let user;
  let role;
  let department;

  if (subjectType === QuotaSubjectType.USER) {
    if (!record.user || !hex24Regex.test(record.user)) {
      errors.push({ field: 'user', message: 'user reference ObjectId is required for subjectType USER' });
    } else {
      user = record.user;
    }
  } else if (subjectType === QuotaSubjectType.ROLE) {
    const validRoles = Object.values(UserRole);
    if (!record.role || !validRoles.includes(record.role)) {
      errors.push({ field: 'role', message: `role must be one of: ${validRoles.join(', ')}` });
    } else {
      role = record.role;
    }
  } else if (subjectType === QuotaSubjectType.DEPARTMENT) {
    const normalizedDept = normalizeDepartmentName(record.department);
    if (!normalizedDept) {
      errors.push({ field: 'department', message: 'department name is required for subjectType DEPARTMENT' });
    } else {
      department = normalizedDept;
    }
  }

  let metric;
  const validMetrics = Object.values(QuotaMetric);
  if (!record.metric || !validMetrics.includes(record.metric)) {
    errors.push({ field: 'metric', message: `metric must be one of: ${validMetrics.join(', ')}` });
  } else {
    metric = record.metric;
  }

  let period;
  const validPeriods = Object.values(QuotaPeriod);
  if (!record.period || !validPeriods.includes(record.period)) {
    errors.push({ field: 'period', message: `period must be one of: ${validPeriods.join(', ')}` });
  } else {
    period = record.period;
  }

  let limit;
  const parsedLimit = Number(record.limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    errors.push({ field: 'limit', message: 'limit must be a positive integer greater than 0' });
  } else {
    limit = parsedLimit;
  }

  let timezone;
  if (!record.timezone || typeof record.timezone !== 'string' || !isValidIanaTimezone(record.timezone.trim())) {
    errors.push({ field: 'timezone', message: 'Valid IANA timezone identifier is required' });
  } else {
    timezone = record.timezone.trim();
  }

  let effectiveFrom;
  if (record.effectiveFrom) {
    if (!isValidCalendarDate(record.effectiveFrom)) {
      errors.push({ field: 'effectiveFrom', message: 'effectiveFrom must be a valid YYYY-MM-DD date' });
    } else {
      effectiveFrom = record.effectiveFrom;
    }
  }

  let effectiveTo;
  if (record.effectiveTo) {
    if (!isValidCalendarDate(record.effectiveTo)) {
      errors.push({ field: 'effectiveTo', message: 'effectiveTo must be a valid YYYY-MM-DD date' });
    } else {
      effectiveTo = record.effectiveTo;
    }
  }

  if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) {
    errors.push({ field: 'effectiveFrom', message: 'effectiveFrom cannot be later than effectiveTo' });
  }

  const isActive = record.isActive !== undefined ? Boolean(record.isActive) : true;

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name,
      scopeType,
      resource,
      resourceType,
      subjectType,
      user,
      role,
      department,
      metric,
      period,
      limit,
      timezone,
      effectiveFrom,
      effectiveTo,
      isActive,
    },
  };
}

export function validateUpdateQuotaBody(data) {
  const record = data || {};
  const errors = [];
  const validated = {};

  if (record.name !== undefined) {
    if (typeof record.name !== 'string' || record.name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
    } else {
      validated.name = record.name.trim();
    }
  }

  if (record.limit !== undefined) {
    const parsedLimit = Number(record.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      errors.push({ field: 'limit', message: 'limit must be a positive integer greater than 0' });
    } else {
      validated.limit = parsedLimit;
    }
  }

  if (record.timezone !== undefined) {
    if (typeof record.timezone !== 'string' || !isValidIanaTimezone(record.timezone.trim())) {
      errors.push({ field: 'timezone', message: 'Valid IANA timezone identifier is required' });
    } else {
      validated.timezone = record.timezone.trim();
    }
  }

  if (record.department !== undefined) {
    validated.department = normalizeDepartmentName(record.department);
  }

  if (record.effectiveFrom !== undefined) {
    if (record.effectiveFrom && !isValidCalendarDate(record.effectiveFrom)) {
      errors.push({ field: 'effectiveFrom', message: 'effectiveFrom must be a valid YYYY-MM-DD date' });
    } else {
      validated.effectiveFrom = record.effectiveFrom || null;
    }
  }

  if (record.effectiveTo !== undefined) {
    if (record.effectiveTo && !isValidCalendarDate(record.effectiveTo)) {
      errors.push({ field: 'effectiveTo', message: 'effectiveTo must be a valid YYYY-MM-DD date' });
    } else {
      validated.effectiveTo = record.effectiveTo || null;
    }
  }

  if (record.isActive !== undefined) {
    validated.isActive = Boolean(record.isActive);
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: validated };
}
