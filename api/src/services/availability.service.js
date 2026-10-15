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
}
