/**
 * CampusFlow API - Availability & Slot Engine Service
 * Authoritative engine for calculating resource availability, operating window alignment,
 * 24:00 midnight normalization, blackout conflicts, existing reservation conflicts,
 * and discrete bookable slot generation.
 */

import { Types } from 'mongoose';
import {
  Resource,
  ResourceStatus,
  AvailabilityRule,
  Blackout,
  Reservation,
  ACTIVE_RESERVATION_STATES,
  TimetableEntry,
} from '../models/index.js';
import { getZonedParts, zonedTimeToUtc, intervalsOverlap } from '../utils/timezone.js';
import { timeStringToMinutes, isValidCalendarDate } from '../utils/dateValidation.js';
import { BadRequestError } from '../utils/errors.js';
import { QuotaService } from './quota.service.js';

/**
 * @typedef {Object} AvailabilityCheckParams
 * @property {string|import('mongoose').Types.ObjectId} resourceId - The target facility or resource ID.
 * @property {Date} startAt - Start of the requested reservation interval (inclusive).
 * @property {Date} endAt - End of the requested reservation interval (exclusive).
 * @property {string|import('mongoose').Types.ObjectId} [excludeReservationId] - Optional reservation ID to exclude (for modifications).
 * @property {Date} [now] - Current reference timestamp for past-slot validation.
 * @property {import('mongoose').ClientSession} [session] - Optional Mongoose client session for ACID transactions.
 *
 * @typedef {Object} AvailabilityCheckResult
 * @property {boolean} available - Whether the resource is available for the requested interval.
 * @property {string} [reason] - Machine-readable rejection code (e.g. 'OUTSIDE_HOURS', 'CONFLICT', 'BLACKOUT').
 * @property {string} [message] - Human-readable explanation of why the slot is unavailable.
 * @property {Object} [conflict] - Details of the conflicting reservation, blackout, or timetable entry.
 * @property {Object} [rule] - Applicable availability rule when available.
 */

export class AvailabilityService {
  /**
   * Authoritatively checks whether a resource is available for the given UTC interval [startAt, endAt).
   * Verifies operational status, active AvailabilityRules, blackout periods, curriculum timetables,
   * and existing concurrent active reservations.
   *
   * @param {AvailabilityCheckParams} params - Verification parameters.
   * @returns {Promise<AvailabilityCheckResult>} Authoritative availability decision object.
   */
  static async checkAvailability(params) {
    const { resourceId, startAt, endAt, excludeReservationId, now = new Date(), session } = params;

    // 1. Basic interval integrity check
    if (!(startAt instanceof Date) || isNaN(startAt.getTime()) || !(endAt instanceof Date) || isNaN(endAt.getTime())) {
      return {
        available: false,
        reason: 'INVALID_INTERVAL',
        message: 'startAt and endAt must be valid Date timestamps',
      };
    }

    if (startAt.getTime() >= endAt.getTime()) {
      return {
        available: false,
        reason: 'INVALID_INTERVAL',
        message: 'startAt must be earlier than endAt for a half-open interval [startAt, endAt)',
      };
    }

    // 2. Resource existence and operational status
    const resource = await Resource.findById(resourceId).session(session || null).lean();
    if (!resource) {
      return {
        available: false,
        reason: 'RESOURCE_NOT_FOUND',
        message: 'Resource not found',
      };
    }

    if (!resource.isActive || resource.status !== ResourceStatus.ACTIVE) {
      return {
        available: false,
        reason: 'RESOURCE_UNAVAILABLE',
        message: `Resource is currently ${resource.status || 'INACTIVE'} and unavailable for bookings`,
      };
    }

    // 3. Find active AvailabilityRule covering this resource
    const rules = await AvailabilityRule.find({
      resource: resource._id,
      isActive: true,
    }).session(session || null).lean();

    if (rules.length === 0) {
      return {
        available: false,
        reason: 'NO_AVAILABILITY_RULE',
        message: 'No active availability rule is configured for this resource',
      };
    }

    // In CampusFlow, rules may have effectiveFrom and effectiveTo.
    // We match the rule active for the start date in the rule's timezone.
    let applicableRule = null;
    let localStartParts = null;

    for (const rule of rules) {
      const parts = getZonedParts(startAt, rule.timezone);
      const dateStr = parts.dateString;
      if (rule.effectiveFrom && rule.effectiveFrom > dateStr) continue;
      if (rule.effectiveTo && rule.effectiveTo < dateStr) continue;
      applicableRule = rule;
      localStartParts = parts;
      break;
    }

    if (!applicableRule || !localStartParts) {
      return {
        available: false,
        reason: 'NO_AVAILABILITY_RULE',
        message: 'No active availability rule is currently effective for this resource on the requested date',
      };
    }

    // 4. Booking Policy validation
    const durationMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60000);
    const policy = applicableRule.bookingPolicy;

    if (durationMinutes < policy.minDurationMinutes) {
      return {
        available: false,
        reason: 'DURATION_TOO_SHORT',
        message: `Booking duration (${durationMinutes}m) is below the minimum required duration (${policy.minDurationMinutes}m)`,
        details: { durationMinutes, minDurationMinutes: policy.minDurationMinutes },
      };
    }

    if (durationMinutes > policy.maxDurationMinutes) {
      return {
        available: false,
        reason: 'DURATION_TOO_LONG',
        message: `Booking duration (${durationMinutes}m) exceeds the maximum allowed duration (${policy.maxDurationMinutes}m)`,
        details: { durationMinutes, maxDurationMinutes: policy.maxDurationMinutes },
      };
    }

    const leadTimeMinutes = Math.round((startAt.getTime() - now.getTime()) / 60000);
    const minLead = policy.minLeadTimeMinutes ?? 0;
    if (leadTimeMinutes < minLead) {
      return {
        available: false,
        reason: 'LEAD_TIME_VIOLATION',
        message: `Reservation must be booked at least ${minLead} minutes in advance (current lead time: ${leadTimeMinutes}m)`,
        details: { leadTimeMinutes, minLeadTimeMinutes: minLead },
      };
    }

    const advanceBookingDays = (startAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    const maxAdvance = policy.maxAdvanceBookingDays ?? 30;
    if (advanceBookingDays > maxAdvance) {
      return {
        available: false,
        reason: 'ADVANCE_BOOKING_EXCEEDED',
        message: `Reservation cannot be booked more than ${maxAdvance} days in advance`,
        details: { advanceBookingDays: Math.ceil(advanceBookingDays), maxAdvanceBookingDays: maxAdvance },
      };
    }

    // 5. Operating Window containment check
    // We check if [startAt, endAt) falls completely within an allowed operating window
    const localEndParts = getZonedParts(endAt, applicableRule.timezone);

    // Determine candidate local start and end time strings
    const candidateStartTime = localStartParts.timeString;
    let candidateEndTime = localEndParts.timeString;

    // Midnight 24:00 boundary handling:
    // If end time is 00:00 on the day immediately following localStartParts date,
    // candidate local end time is normalized to "24:00" for window comparison.
    if (localEndParts.dateString !== localStartParts.dateString) {
      const nextDayOfStart = new Date(Date.UTC(localStartParts.year, localStartParts.month - 1, localStartParts.day + 1));
      const nextDayStr = `${nextDayOfStart.getUTCFullYear()}-${String(nextDayOfStart.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDayOfStart.getUTCDate()).padStart(2, '0')}`;
      if (localEndParts.dateString === nextDayStr && localEndParts.timeString === '00:00') {
        candidateEndTime = '24:00';
      } else {
        // Multi-day booking spanning past midnight into subsequent day
        return {
          available: false,
          reason: 'OUTSIDE_OPERATING_HOURS',
          message: 'Booking spans across midnight into a subsequent operating day',
        };
      }
    }

    const candidateStartMinutes = timeStringToMinutes(candidateStartTime);
    const candidateEndMinutes = timeStringToMinutes(candidateEndTime);

    const dayWindows = applicableRule.windows.filter(
      (w) => w.dayOfWeek === localStartParts.weekday
    );

    let fallsInWindow = false;
    for (const win of dayWindows) {
      const winStartMinutes = timeStringToMinutes(win.startTime);
      const winEndMinutes = timeStringToMinutes(win.endTime);

      if (candidateStartMinutes >= winStartMinutes && candidateEndMinutes <= winEndMinutes) {
        fallsInWindow = true;
        break;
      }
    }

    if (!fallsInWindow) {
      return {
        available: false,
        reason: 'OUTSIDE_OPERATING_HOURS',
        message: `Requested time ${candidateStartTime}-${candidateEndTime} on ${localStartParts.weekday} is outside configured operating hours`,
        details: { weekday: localStartParts.weekday, requested: `${candidateStartTime}-${candidateEndTime}` },
      };
    }

    // 6. Blackout conflict check (half-open interval overlap)
    // startAt < blackout.endAt && endAt > blackout.startAt
    const blackoutConflict = await Blackout.findOne({
      resource: resource._id,
      isActive: true,
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    }).session(session || null).lean();

    if (blackoutConflict) {
      return {
        available: false,
        reason: 'BLACKOUT_CONFLICT',
        message: `Conflicts with active blackout: "${blackoutConflict.reason}"`,
        details: {
          blackoutId: blackoutConflict._id.toString(),
          reason: blackoutConflict.reason,
          startAt: blackoutConflict.startAt,
          endAt: blackoutConflict.endAt,
        },
      };
    }

    // 6.5 Timetable conflict check (hard availability constraint: half-open interval overlap)
    // startAt < timetable.endAt && endAt > timetable.startAt
    const timetableConflict = await TimetableEntry.findOne({
      resource: resource._id,
      isPublished: true,
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    }).session(session || null).lean();

    if (timetableConflict) {
      return {
        available: false,
        reason: 'TIMETABLE_CONFLICT',
        message: 'The requested time slot conflicts with an academic timetable session',
      };
    }

    // 7. Existing active reservation conflict check (half-open interval overlap)
    // startAt < existing.endAt && endAt > existing.startAt
    const reservationQuery = {
      resource: resource._id,
      status: { $in: ACTIVE_RESERVATION_STATES },
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    };

    if (excludeReservationId) {
      reservationQuery._id = { $ne: new Types.ObjectId(excludeReservationId) };
    }

    const existingConflict = await Reservation.findOne(reservationQuery).session(session || null).lean();

    if (existingConflict) {
      return {
        available: false,
        reason: 'RESERVATION_CONFLICT',
        message: 'The requested time slot conflicts with an existing reservation',
        details: {
          reservationId: existingConflict._id.toString(),
          startAt: existingConflict.startAt,
          endAt: existingConflict.endAt,
          status: existingConflict.status,
        },
      };
    }

    // All checks satisfied!
    return {
      available: true,
      rule: applicableRule,
    };
  }

  /**
   * Generates discrete bookable slots for a resource on a specific calendar date (YYYY-MM-DD).
   * Computes operational windows, divides time into slots of duration `slotDurationMinutes`,
   * checks for overlapping bookings/blackouts, and marks availability for each slot.
   *
   * @param {Object} params - Slot generation parameters.
   * @param {string|import('mongoose').Types.ObjectId} params.resourceId - Resource ID.
   * @param {string} params.date - Calendar date string in 'YYYY-MM-DD' format.
   * @param {number} params.slotDurationMinutes - Duration of each slot in minutes (e.g. 60).
   * @param {Date} [params.now] - Current timestamp for past-slot determination.
   * @returns {Promise<Array<{ startAt: string, endAt: string, available: boolean, reason?: string }>>} Array of bookable slot objects.
   * @throws {BadRequestError} If the date format is invalid.
   */
  static async calculateSlots(params) {
    const { resourceId, date, slotDurationMinutes, now = new Date() } = params;

    if (!isValidCalendarDate(date)) {
      throw new BadRequestError(`Invalid calendar date: "${date}". Expected format YYYY-MM-DD.`);
    }

    const resource = await Resource.findById(resourceId).lean();
    if (!resource || !resource.isActive || resource.status !== ResourceStatus.ACTIVE) {
      return [];
    }

    // Retrieve active rule covering this date
    const rules = await AvailabilityRule.find({
      resource: resource._id,
      isActive: true,
    }).lean();

    let rule = null;
    for (const r of rules) {
      if (r.effectiveFrom && r.effectiveFrom > date) continue;
      if (r.effectiveTo && r.effectiveTo < date) continue;
      rule = r;
      break;
    }

    if (!rule) {
      return [];
    }

    // Determine day of week in rule's timezone for this date
    const probeDate = zonedTimeToUtc(date, '12:00', rule.timezone);
    const probeParts = getZonedParts(probeDate, rule.timezone);
    const weekday = probeParts.weekday;

    const windows = rule.windows.filter((w) => w.dayOfWeek === weekday);
    if (windows.length === 0) {
      return [];
    }

    const slotDuration = slotDurationMinutes || rule.bookingPolicy.minDurationMinutes || 60;
    const policy = rule.bookingPolicy;

    // Fetch all active blackouts, existing reservations, and published timetable entries for this resource on this calendar day
    const dayStartUtc = zonedTimeToUtc(date, '00:00', rule.timezone);
    const dayEndUtc = zonedTimeToUtc(date, '24:00', rule.timezone);

    const [blackouts, reservations, timetables] = await Promise.all([
      Blackout.find({
        resource: resource._id,
        isActive: true,
        startAt: { $lt: dayEndUtc },
        endAt: { $gt: dayStartUtc },
      }).lean(),
      Reservation.find({
        resource: resource._id,
        status: { $in: ACTIVE_RESERVATION_STATES },
        startAt: { $lt: dayEndUtc },
        endAt: { $gt: dayStartUtc },
      }).lean(),
      TimetableEntry.find({
        resource: resource._id,
        isPublished: true,
        startAt: { $lt: dayEndUtc },
        endAt: { $gt: dayStartUtc },
      }).lean(),
    ]);

    const generatedSlots = [];

    for (const win of windows) {
      const winStartM = timeStringToMinutes(win.startTime);
      const winEndM = timeStringToMinutes(win.endTime);

      let currentStartM = winStartM;
      while (currentStartM + slotDuration <= winEndM) {
        const currentEndM = currentStartM + slotDuration;

        const startH = Math.floor(currentStartM / 60);
        const startMin = currentStartM % 60;
        const endH = Math.floor(currentEndM / 60);
        const endMin = currentEndM % 60;

        const startTimeStr = `${String(startH).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
        const endTimeStr =
          currentEndM === 1440
            ? '24:00'
            : `${String(endH).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

        const slotStartUtc = zonedTimeToUtc(date, startTimeStr, rule.timezone);
        const slotEndUtc = zonedTimeToUtc(date, endTimeStr, rule.timezone);

        // Evaluate availability of this slot
        let isAvailable = true;
        let reason;

        // Lead time check
        const leadTimeM = Math.round((slotStartUtc.getTime() - now.getTime()) / 60000);
        if (leadTimeM < (policy.minLeadTimeMinutes ?? 0)) {
          isAvailable = false;
          reason = 'LEAD_TIME_VIOLATION';
        }

        // Advance booking check
        const advanceDays = (slotStartUtc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (isAvailable && advanceDays > (policy.maxAdvanceBookingDays ?? 30)) {
          isAvailable = false;
          reason = 'ADVANCE_BOOKING_EXCEEDED';
        }

        // Blackout check
        if (isAvailable) {
          const hasBlackout = blackouts.some((b) =>
            intervalsOverlap(slotStartUtc, slotEndUtc, b.startAt, b.endAt)
          );
          if (hasBlackout) {
            isAvailable = false;
            reason = 'BLACKOUT_CONFLICT';
          }
        }

        // Existing reservation check
        if (isAvailable) {
          const hasReservation = reservations.some((r) =>
            intervalsOverlap(slotStartUtc, slotEndUtc, r.startAt, r.endAt)
          );
          if (hasReservation) {
            isAvailable = false;
            reason = 'RESERVATION_CONFLICT';
          }
        }

        // Timetable conflict check
        if (isAvailable) {
          const hasTimetable = timetables.some((t) =>
            intervalsOverlap(slotStartUtc, slotEndUtc, t.startAt, t.endAt)
          );
          if (hasTimetable) {
            isAvailable = false;
            reason = 'TIMETABLE_CONFLICT';
          }
        }

        generatedSlots.push({
          startAt: slotStartUtc,
          endAt: slotEndUtc,
          startTime: startTimeStr,
          endTime: endTimeStr,
          durationMinutes: slotDuration,
          available: isAvailable,
          reason,
        });

        currentStartM += slotDuration;
      }
    }

    return generatedSlots;
  }

  /**
   * Bounded batch availability calculation for all resources in a building.
   * Uses a coordinated 6-query batch engine reducing O(N) queries to O(1).
   *
   * @param {Object} params
   * @param {string} params.building - Building name matching location.building.
   * @param {Date} params.startAt - Requested start UTC Date.
   * @param {Date} params.endAt - Requested end UTC Date.
   * @param {string} [params.timezone] - Requested or building timezone.
   * @param {number} [params.limit=50] - Maximum resources to process (capped at 50).
   * @param {string} [params.userId] - Optional authenticated user ID for quota evaluation.
   * @param {Date} [params.now=new Date()] - Reference timestamp.
   * @returns {Promise<Object|null>} Building availability summary and facility list, or null if no resources found.
   */
  static async checkBuildingAvailability(params) {
    const { building, startAt, endAt, timezone, limit = 50, userId, now = new Date() } = params;

    // 1. Fetch matching active resources for the building
    const safeBuilding = building.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const buildingRegex = new RegExp(`^${safeBuilding}$`, 'i');

    const effectiveLimit = Math.min(Math.max(1, limit), 50);
    const resources = await Resource.find({
      'location.building': buildingRegex,
      isActive: true,
    })
      .populate('resourceType', 'name code category')
      .limit(effectiveLimit)
      .lean();

    if (!resources || resources.length === 0) {
      return null;
    }

    const resourceIds = resources.map((r) => r._id);
    const UPCOMING_THRESHOLD_MINUTES = 30;
    const endAtPlusThreshold = new Date(endAt.getTime() + UPCOMING_THRESHOLD_MINUTES * 60000);

    // 2. Coordinated batch queries (Queries 2 to 6)
    const [rules, blackouts, timetables, activeReservations, upcomingReservations] = await Promise.all([
      AvailabilityRule.find({ resource: { $in: resourceIds }, isActive: true }).lean(),
      Blackout.find({
        resource: { $in: resourceIds },
        isActive: true,
        startAt: { $lt: endAt },
        endAt: { $gt: startAt },
      }).lean(),
      TimetableEntry.find({
        resource: { $in: resourceIds },
        isPublished: true,
        startAt: { $lt: endAt },
        endAt: { $gt: startAt },
      }).lean(),
      Reservation.find({
        resource: { $in: resourceIds },
        status: { $in: ACTIVE_RESERVATION_STATES },
        startAt: { $lt: endAt },
        endAt: { $gt: startAt },
      }).lean(),
      Reservation.find({
        resource: { $in: resourceIds },
        status: { $in: ACTIVE_RESERVATION_STATES },
        startAt: { $gte: endAt, $lte: endAtPlusThreshold },
      }).sort({ startAt: 1 }).lean(),
    ]);

    // 3. Map documents to resourceId in-memory
    const rulesByResource = new Map();
    const blackoutsByResource = new Map();
    const timetablesByResource = new Map();
    const reservationsByResource = new Map();
    const upcomingByResource = new Map();

    for (const rule of rules) {
      const idStr = rule.resource.toString();
      if (!rulesByResource.has(idStr)) rulesByResource.set(idStr, []);
      rulesByResource.get(idStr).push(rule);
    }
    for (const b of blackouts) {
      const idStr = b.resource.toString();
      if (!blackoutsByResource.has(idStr)) blackoutsByResource.set(idStr, []);
      blackoutsByResource.get(idStr).push(b);
    }
    for (const t of timetables) {
      const idStr = t.resource.toString();
      if (!timetablesByResource.has(idStr)) timetablesByResource.set(idStr, []);
      timetablesByResource.get(idStr).push(t);
    }
    for (const r of activeReservations) {
      const idStr = r.resource.toString();
      if (!reservationsByResource.has(idStr)) reservationsByResource.set(idStr, []);
      reservationsByResource.get(idStr).push(r);
    }
    for (const u of upcomingReservations) {
      const idStr = u.resource.toString();
      if (!upcomingByResource.has(idStr)) upcomingByResource.set(idStr, []);
      upcomingByResource.get(idStr).push(u);
    }

    // 4. In-memory evaluation per facility with partial-failure isolation
    const facilityResults = [];

    for (const resource of resources) {
      const idStr = resource._id.toString();

      try {
        // Priority 1: Maintenance Status
        if (resource.status === ResourceStatus.MAINTENANCE) {
          facilityResults.push({
            id: idStr,
            name: resource.name,
            code: resource.code,
            capacity: resource.capacity,
            floor: resource.location?.floor || '1',
            roomNumber: resource.location?.roomNumber || '',
            resourceType: resource.resourceType ? {
              id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
              name: resource.resourceType.name || '',
              code: resource.resourceType.code || '',
              category: resource.resourceType.category || '',
            } : null,
            generalStatus: resource.status,
            isActive: resource.isActive,
            availability: {
              available: false,
              visualStatus: 'maintenance',
              reason: 'RESOURCE_UNAVAILABLE',
              message: 'Resource is currently under maintenance',
              occupiedSoon: false,
              nextBookingAt: null,
              quota: null,
            },
          });
          continue;
        }

        // Operational Status
        if (!resource.isActive || resource.status !== ResourceStatus.ACTIVE) {
          facilityResults.push({
            id: idStr,
            name: resource.name,
            code: resource.code,
            capacity: resource.capacity,
            floor: resource.location?.floor || '1',
            roomNumber: resource.location?.roomNumber || '',
            resourceType: resource.resourceType ? {
              id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
              name: resource.resourceType.name || '',
              code: resource.resourceType.code || '',
              category: resource.resourceType.category || '',
            } : null,
            generalStatus: resource.status,
            isActive: resource.isActive,
            availability: {
              available: false,
              visualStatus: 'unavailable',
              reason: 'RESOURCE_UNAVAILABLE',
              message: `Resource is currently ${resource.status || 'INACTIVE'} and unavailable`,
              occupiedSoon: false,
              nextBookingAt: null,
              quota: null,
            },
          });
          continue;
        }

        // Active Rules check
        const resRules = rulesByResource.get(idStr) || [];
        if (resRules.length === 0) {
          facilityResults.push({
            id: idStr,
            name: resource.name,
            code: resource.code,
            capacity: resource.capacity,
            floor: resource.location?.floor || '1',
            roomNumber: resource.location?.roomNumber || '',
            resourceType: resource.resourceType ? {
              id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
              name: resource.resourceType.name || '',
              code: resource.resourceType.code || '',
              category: resource.resourceType.category || '',
            } : null,
            generalStatus: resource.status,
            isActive: resource.isActive,
            availability: {
              available: false,
              visualStatus: 'unknown',
              reason: 'NO_AVAILABILITY_RULE',
              message: 'No active availability rule is configured for this resource',
              occupiedSoon: false,
              nextBookingAt: null,
              quota: null,
            },
          });
          continue;
        }

        let applicableRule = null;
        let localStartParts = null;
        for (const rule of resRules) {
          const parts = getZonedParts(startAt, rule.timezone);
          const dateStr = parts.dateString;
          if (rule.effectiveFrom && rule.effectiveFrom > dateStr) continue;
          if (rule.effectiveTo && rule.effectiveTo < dateStr) continue;
          applicableRule = rule;
          localStartParts = parts;
          break;
        }

        if (!applicableRule || !localStartParts) {
          facilityResults.push({
            id: idStr,
            name: resource.name,
            code: resource.code,
            capacity: resource.capacity,
            floor: resource.location?.floor || '1',
            roomNumber: resource.location?.roomNumber || '',
            resourceType: resource.resourceType ? {
              id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
              name: resource.resourceType.name || '',
              code: resource.resourceType.code || '',
              category: resource.resourceType.category || '',
            } : null,
            generalStatus: resource.status,
            isActive: resource.isActive,
            availability: {
              available: false,
              visualStatus: 'unknown',
              reason: 'NO_AVAILABILITY_RULE',
              message: 'No active availability rule is currently effective for this resource on the requested date',
              occupiedSoon: false,
              nextBookingAt: null,
              quota: null,
            },
          });
          continue;
        }

        // Booking Policy check
        const durationMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60000);
        const policy = applicableRule.bookingPolicy;
        if (durationMinutes < policy.minDurationMinutes) {
          facilityResults.push({
            id: idStr,
            name: resource.name,
            code: resource.code,
            capacity: resource.capacity,
            floor: resource.location?.floor || '1',
            roomNumber: resource.location?.roomNumber || '',
            resourceType: resource.resourceType ? {
              id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
              name: resource.resourceType.name || '',
              code: resource.resourceType.code || '',
              category: resource.resourceType.category || '',
            } : null,
            generalStatus: resource.status,
            isActive: resource.isActive,
            availability: {
              available: false,
              visualStatus: 'unavailable',
              reason: 'DURATION_TOO_SHORT',
              message: `Booking duration (${durationMinutes}m) is below minimum (${policy.minDurationMinutes}m)`,
              occupiedSoon: false,
              nextBookingAt: null,
              quota: null,
            },
          });
          continue;
        }

        if (durationMinutes > policy.maxDurationMinutes) {
          facilityResults.push({
            id: idStr,
            name: resource.name,
            code: resource.code,
            capacity: resource.capacity,
            floor: resource.location?.floor || '1',
            roomNumber: resource.location?.roomNumber || '',
            resourceType: resource.resourceType ? {
              id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
              name: resource.resourceType.name || '',
              code: resource.resourceType.code || '',
              category: resource.resourceType.category || '',
            } : null,
            generalStatus: resource.status,
            isActive: resource.isActive,
            availability: {
              available: false,
              visualStatus: 'unavailable',
              reason: 'DURATION_TOO_LONG',
              message: `Booking duration (${durationMinutes}m) exceeds maximum (${policy.maxDurationMinutes}m)`,
              occupiedSoon: false,
              nextBookingAt: null,
              quota: null,
            },
          });
          continue;
        }

        const leadTimeMinutes = Math.round((startAt.getTime() - now.getTime()) / 60000);
        const minLead = policy.minLeadTimeMinutes ?? 0;
        if (leadTimeMinutes < minLead) {
          facilityResults.push({
            id: idStr,
            name: resource.name,
            code: resource.code,
            capacity: resource.capacity,
            floor: resource.location?.floor || '1',
            roomNumber: resource.location?.roomNumber || '',
            resourceType: resource.resourceType ? {
              id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
              name: resource.resourceType.name || '',
              code: resource.resourceType.code || '',
              category: resource.resourceType.category || '',
            } : null,
            generalStatus: resource.status,
            isActive: resource.isActive,
            availability: {
              available: false,
              visualStatus: 'unavailable',
              reason: 'LEAD_TIME_VIOLATION',
              message: `Must be booked at least ${minLead} minutes in advance`,
              occupiedSoon: false,
              nextBookingAt: null,
              quota: null,
            },
          });
          continue;
        }

        const advanceBookingDays = (startAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        const maxAdvance = policy.maxAdvanceBookingDays ?? 30;
        if (advanceBookingDays > maxAdvance) {
          facilityResults.push({
            id: idStr,
            name: resource.name,
            code: resource.code,
            capacity: resource.capacity,
            floor: resource.location?.floor || '1',
            roomNumber: resource.location?.roomNumber || '',
            resourceType: resource.resourceType ? {
              id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
              name: resource.resourceType.name || '',
              code: resource.resourceType.code || '',
              category: resource.resourceType.category || '',
            } : null,
            generalStatus: resource.status,
            isActive: resource.isActive,
            availability: {
              available: false,
              visualStatus: 'unavailable',
              reason: 'ADVANCE_BOOKING_EXCEEDED',
              message: `Cannot be booked more than ${maxAdvance} days in advance`,
              occupiedSoon: false,
              nextBookingAt: null,
              quota: null,
            },
          });
          continue;
        }

        // Operating Window Containment check with 24:00 normalization
        const localEndParts = getZonedParts(endAt, applicableRule.timezone);
        const candidateStartTime = localStartParts.timeString;
        let candidateEndTime = localEndParts.timeString;

        if (localEndParts.dateString !== localStartParts.dateString) {
          const nextDayOfStart = new Date(Date.UTC(localStartParts.year, localStartParts.month - 1, localStartParts.day + 1));
          const nextDayStr = `${nextDayOfStart.getUTCFullYear()}-${String(nextDayOfStart.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDayOfStart.getUTCDate()).padStart(2, '0')}`;
          if (localEndParts.dateString === nextDayStr && localEndParts.timeString === '00:00') {
            candidateEndTime = '24:00';
          } else {
            facilityResults.push({
              id: idStr,
              name: resource.name,
              code: resource.code,
              capacity: resource.capacity,
              floor: resource.location?.floor || '1',
              roomNumber: resource.location?.roomNumber || '',
              resourceType: resource.resourceType ? {
                id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
                name: resource.resourceType.name || '',
                code: resource.resourceType.code || '',
                category: resource.resourceType.category || '',
              } : null,
              generalStatus: resource.status,
              isActive: resource.isActive,
              availability: {
                available: false,
                visualStatus: 'unavailable',
                reason: 'OUTSIDE_OPERATING_HOURS',
                message: 'Booking spans across midnight into a subsequent operating day',
                occupiedSoon: false,
                nextBookingAt: null,
                quota: null,
              },
            });
            continue;
          }
        }

        const candidateStartMinutes = timeStringToMinutes(candidateStartTime);
        const candidateEndMinutes = timeStringToMinutes(candidateEndTime);
        const dayWindows = applicableRule.windows.filter((w) => w.dayOfWeek === localStartParts.weekday);

        let fallsInWindow = false;
        for (const win of dayWindows) {
          const winStartMinutes = timeStringToMinutes(win.startTime);
          const winEndMinutes = timeStringToMinutes(win.endTime);
          if (candidateStartMinutes >= winStartMinutes && candidateEndMinutes <= winEndMinutes) {
            fallsInWindow = true;
            break;
          }
        }

        if (!fallsInWindow) {
          facilityResults.push({
            id: idStr,
            name: resource.name,
            code: resource.code,
            capacity: resource.capacity,
            floor: resource.location?.floor || '1',
            roomNumber: resource.location?.roomNumber || '',
            resourceType: resource.resourceType ? {
              id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
              name: resource.resourceType.name || '',
              code: resource.resourceType.code || '',
              category: resource.resourceType.category || '',
            } : null,
            generalStatus: resource.status,
            isActive: resource.isActive,
            availability: {
              available: false,
              visualStatus: 'unavailable',
              reason: 'OUTSIDE_OPERATING_HOURS',
              message: `Requested time ${candidateStartTime}-${candidateEndTime} on ${localStartParts.weekday} is outside configured operating hours`,
              occupiedSoon: false,
              nextBookingAt: null,
              quota: null,
            },
          });
          continue;
        }

        // Blackout conflict check
        const resBlackouts = blackoutsByResource.get(idStr) || [];
        const blackoutConflict = resBlackouts.find((b) => b.startAt < endAt && b.endAt > startAt);
        if (blackoutConflict) {
          const isMaintBlackout = blackoutConflict.category === 'MAINTENANCE' || /maint/i.test(blackoutConflict.reason);
          facilityResults.push({
            id: idStr,
            name: resource.name,
            code: resource.code,
            capacity: resource.capacity,
            floor: resource.location?.floor || '1',
            roomNumber: resource.location?.roomNumber || '',
            resourceType: resource.resourceType ? {
              id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
              name: resource.resourceType.name || '',
              code: resource.resourceType.code || '',
              category: resource.resourceType.category || '',
            } : null,
            generalStatus: resource.status,
            isActive: resource.isActive,
            availability: {
              available: false,
              visualStatus: isMaintBlackout ? 'maintenance' : 'unavailable',
              reason: 'BLACKOUT_CONFLICT',
              message: `Conflicts with active blackout: "${blackoutConflict.reason}"`,
              occupiedSoon: false,
              nextBookingAt: null,
              quota: null,
            },
          });
          continue;
        }

        // Timetable conflict check
        const resTimetables = timetablesByResource.get(idStr) || [];
        const timetableConflict = resTimetables.find((t) => t.startAt < endAt && t.endAt > startAt);
        if (timetableConflict) {
          facilityResults.push({
            id: idStr,
            name: resource.name,
            code: resource.code,
            capacity: resource.capacity,
            floor: resource.location?.floor || '1',
            roomNumber: resource.location?.roomNumber || '',
            resourceType: resource.resourceType ? {
              id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
              name: resource.resourceType.name || '',
              code: resource.resourceType.code || '',
              category: resource.resourceType.category || '',
            } : null,
            generalStatus: resource.status,
            isActive: resource.isActive,
            availability: {
              available: false,
              visualStatus: 'unavailable',
              reason: 'TIMETABLE_CONFLICT',
              message: 'The requested time slot conflicts with an academic timetable session',
              occupiedSoon: false,
              nextBookingAt: null,
              quota: null,
            },
          });
          continue;
        }

        // Active reservation conflict check
        const resReservations = reservationsByResource.get(idStr) || [];
        const reservationConflict = resReservations.find((r) => r.startAt < endAt && r.endAt > startAt);
        if (reservationConflict) {
          facilityResults.push({
            id: idStr,
            name: resource.name,
            code: resource.code,
            capacity: resource.capacity,
            floor: resource.location?.floor || '1',
            roomNumber: resource.location?.roomNumber || '',
            resourceType: resource.resourceType ? {
              id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
              name: resource.resourceType.name || '',
              code: resource.resourceType.code || '',
              category: resource.resourceType.category || '',
            } : null,
            generalStatus: resource.status,
            isActive: resource.isActive,
            availability: {
              available: false,
              visualStatus: 'occupied',
              reason: 'RESERVATION_CONFLICT',
              message: 'The requested time slot conflicts with an existing reservation',
              occupiedSoon: false,
              nextBookingAt: null,
              quota: null,
            },
          });
          continue;
        }

        // Quota check (if userId provided)
        let quotaInfo = null;
        let quotaExceeded = false;
        let quotaViolation = null;

        if (userId) {
          const quotaEvaluation = await QuotaService.evaluateQuotas({
            userId,
            resourceId: resource._id,
            startAt,
            endAt,
          });

          if (!quotaEvaluation.allowed) {
            quotaExceeded = true;
            quotaViolation = quotaEvaluation.violation;
            quotaInfo = { evaluated: true, allowed: false, violation: quotaViolation };
          } else {
            quotaInfo = { evaluated: true, allowed: true };
          }
        }

        if (quotaExceeded) {
          facilityResults.push({
            id: idStr,
            name: resource.name,
            code: resource.code,
            capacity: resource.capacity,
            floor: resource.location?.floor || '1',
            roomNumber: resource.location?.roomNumber || '',
            resourceType: resource.resourceType ? {
              id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
              name: resource.resourceType.name || '',
              code: resource.resourceType.code || '',
              category: resource.resourceType.category || '',
            } : null,
            generalStatus: resource.status,
            isActive: resource.isActive,
            availability: {
              available: false,
              visualStatus: 'unavailable',
              reason: 'QUOTA_EXCEEDED',
              message: 'User booking quota limit exceeded for this resource',
              occupiedSoon: false,
              nextBookingAt: null,
              quota: quotaInfo,
            },
          });
          continue;
        }

        // All checks passed! Check upcoming booking for Occupied Soon UX modifier
        const upcomingList = upcomingByResource.get(idStr) || [];
        const upcomingRes = upcomingList[0];
        const occupiedSoon = Boolean(upcomingRes);

        facilityResults.push({
          id: idStr,
          name: resource.name,
          code: resource.code,
          capacity: resource.capacity,
          floor: resource.location?.floor || '1',
          roomNumber: resource.location?.roomNumber || '',
          resourceType: resource.resourceType ? {
            id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
            name: resource.resourceType.name || '',
            code: resource.resourceType.code || '',
            category: resource.resourceType.category || '',
          } : null,
          generalStatus: resource.status,
          isActive: resource.isActive,
          availability: {
            available: true,
            visualStatus: occupiedSoon ? 'occupied_soon' : 'available',
            reason: null,
            message: 'Resource is available for booking',
            occupiedSoon,
            nextBookingAt: upcomingRes ? upcomingRes.startAt.toISOString() : null,
            quota: quotaInfo,
          },
        });
      } catch (err) {
        // Fail closed on individual resource technical error
        facilityResults.push({
          id: idStr,
          name: resource.name,
          code: resource.code,
          capacity: resource.capacity,
          floor: resource.location?.floor || '1',
          roomNumber: resource.location?.roomNumber || '',
          resourceType: resource.resourceType ? {
            id: resource.resourceType._id?.toString() || resource.resourceType.toString(),
            name: resource.resourceType.name || '',
            code: resource.resourceType.code || '',
            category: resource.resourceType.category || '',
          } : null,
          generalStatus: resource.status,
          isActive: resource.isActive,
          availability: {
            available: false,
            visualStatus: 'unknown',
            reason: 'CALCULATION_ERROR',
            message: 'Technical failure calculating availability for this resource',
            occupiedSoon: false,
            nextBookingAt: null,
            quota: null,
            errorDetail: err.message,
          },
        });
      }
    }

    // 5. Aggregate building summary counts
    const counts = {
      available: 0,
      occupied: 0,
      maintenance: 0,
      unavailable: 0,
      unknown: 0,
    };

    for (const f of facilityResults) {
      const vs = f.availability.visualStatus;
      if (vs === 'available' || vs === 'occupied_soon') {
        counts.available += 1;
      } else if (vs === 'occupied') {
        counts.occupied += 1;
      } else if (vs === 'maintenance') {
        counts.maintenance += 1;
      } else if (vs === 'unknown') {
        counts.unknown += 1;
      } else {
        counts.unavailable += 1;
      }
    }

    const total = facilityResults.length;
    const hasAvailability = counts.available > 0;
    const availabilityRatio = `${counts.available}/${total}`;
    const displayBadge = `${counts.available} of ${total} Facilities Available`;

    let buildingVisualState = 'unavailable';
    if (counts.available === total) {
      buildingVisualState = 'fully_available';
    } else if (counts.available > 0) {
      buildingVisualState = 'partially_available';
    } else if (counts.occupied === total) {
      buildingVisualState = 'fully_occupied';
    } else if (counts.maintenance === total) {
      buildingVisualState = 'maintenance_blocked';
    } else if (counts.unknown > 0 && counts.available === 0) {
      buildingVisualState = 'indeterminate_warning';
    } else {
      buildingVisualState = 'unavailable';
    }

    return {
      building,
      queryInterval: {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        durationMinutes: Math.round((endAt.getTime() - startAt.getTime()) / 60000),
        timezone: timezone || 'UTC',
      },
      summary: {
        total,
        counts,
        hasAvailability,
        availabilityRatio,
        displayBadge,
        buildingVisualState,
      },
      resources: facilityResults,
    };
  }
}
