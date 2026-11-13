/**
 * CampusFlow API - Holiday Service
 * Manages official public holidays, administrative campus declarations,
 * offline caching, booking conflict evaluations, and affected reservation reviews.
 */

import { Holiday, HolidaySource, HolidayCategory, HolidayScope, HolidayStatus, Reservation, ACTIVE_RESERVATION_STATES, Resource } from '../models/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Authoritative institutional & national public holiday template catalog.
 * Acts as the verified baseline dataset that can be loaded/synchronized offline
 * without relying on external network calls during normal booking workflows.
 */
const PREDEFINED_PUBLIC_HOLIDAYS = [
  // 2026 Academic Year Reference
  { name: 'New Year Day', date: '2026-01-01', category: HolidayCategory.NATIONAL },
  { name: 'Republic Day', date: '2026-01-26', category: HolidayCategory.NATIONAL },
  { name: 'Maha Shivaratri', date: '2026-02-15', category: HolidayCategory.REGIONAL },
  { name: 'Holi Festival', date: '2026-03-04', category: HolidayCategory.NATIONAL },
  { name: 'Id-ul-Fitr (Ramadan)', date: '2026-03-21', category: HolidayCategory.NATIONAL },
  { name: 'Mahavir Jayanti', date: '2026-03-31', category: HolidayCategory.NATIONAL },
  { name: 'Good Friday', date: '2026-04-03', category: HolidayCategory.NATIONAL },
  { name: 'Dr. B.R. Ambedkar Jayanti', date: '2026-04-14', category: HolidayCategory.NATIONAL },
  { name: 'Buddha Purnima', date: '2026-05-31', category: HolidayCategory.NATIONAL },
  { name: 'Bakrid / Eid al-Adha', date: '2026-05-27', category: HolidayCategory.NATIONAL },
  { name: 'Muharram', date: '2026-06-26', category: HolidayCategory.NATIONAL },
  { name: 'Independence Day', date: '2026-08-15', category: HolidayCategory.NATIONAL },
  { name: 'Janmashtami', date: '2026-09-04', category: HolidayCategory.REGIONAL },
  { name: 'Milad-un-Nabi (Id-e-Milad)', date: '2026-08-26', category: HolidayCategory.NATIONAL },
  { name: 'Mahatma Gandhi Jayanti', date: '2026-10-02', category: HolidayCategory.NATIONAL },
  { name: 'Dussehra (Vijaya Dashami)', date: '2026-10-20', category: HolidayCategory.NATIONAL },
  { name: 'Diwali (Deepavali)', date: '2026-11-08', category: HolidayCategory.NATIONAL },
  { name: 'Guru Nanak Jayanti', date: '2026-11-24', category: HolidayCategory.NATIONAL },
  { name: 'Christmas Day', date: '2026-12-25', category: HolidayCategory.NATIONAL },
  { name: 'Winter Break & Year-End Campus Closure', date: '2026-12-26', category: HolidayCategory.INSTITUTIONAL },
  { name: 'Winter Break & Year-End Campus Closure', date: '2026-12-27', category: HolidayCategory.INSTITUTIONAL },
  { name: 'Winter Break & Year-End Campus Closure', date: '2026-12-28', category: HolidayCategory.INSTITUTIONAL },
  { name: 'Winter Break & Year-End Campus Closure', date: '2026-12-29', category: HolidayCategory.INSTITUTIONAL },
  { name: 'Winter Break & Year-End Campus Closure', date: '2026-12-30', category: HolidayCategory.INSTITUTIONAL },
  { name: 'New Year Eve (Campus Closure)', date: '2026-12-31', category: HolidayCategory.INSTITUTIONAL },
  // Institution Specific Annual Observances
  { name: 'University Annual Convocation Day', date: '2026-02-28', category: HolidayCategory.INSTITUTIONAL },
  { name: 'Campus Founders & Innovation Day', date: '2026-09-15', category: HolidayCategory.INSTITUTIONAL },
];

export class HolidayService {
  /**
   * Synchronizes or seeds predefined official public holidays for a given year.
   * Runs idempotently without duplicating entries.
   */
  static async syncPredefinedHolidays(year = 2026, performedBy = null) {
    logger.info(`[HolidayService] Synchronizing public holidays for year ${year}...`);
    const results = { synced: 0, skipped: 0 };

    for (const item of PREDEFINED_PUBLIC_HOLIDAYS) {
      const itemYear = parseInt(item.date.split('-')[0], 10);
      if (itemYear !== year) continue;

      const startAt = new Date(`${item.date}T00:00:00.000Z`);
      const endAt = new Date(`${item.date}T23:59:59.999Z`);

      const existing = await Holiday.findOne({
        date: item.date,
        name: item.name,
        source: HolidaySource.PREDEFINED_PUBLIC,
      });

      if (!existing) {
        await Holiday.create({
          name: item.name,
          date: item.date,
          startAt,
          endAt,
          year,
          source: HolidaySource.PREDEFINED_PUBLIC,
          category: item.category,
          scope: HolidayScope.CAMPUS_WIDE,
          isUniversityClosed: true,
          reason: `Official Public Holiday: ${item.name}`,
          status: HolidayStatus.PUBLISHED,
          createdBy: performedBy,
          auditTrail: [
            {
              action: 'SYNCED',
              performedBy,
              notes: 'Populated from official institutional public holiday catalog',
            },
          ],
        });
        results.synced += 1;
      } else {
        results.skipped += 1;
      }
    }

    return results;
  }

  /**
   * Retrieves active, published holidays within an optional date range and block filter.
   */
  static async listHolidays(filter = {}) {
    const query = { status: HolidayStatus.PUBLISHED };

    if (filter.year) {
      query.year = Number(filter.year);
    }

    if (filter.startDate && filter.endDate) {
      query.startAt = { $lte: new Date(filter.endDate) };
      query.endAt = { $gte: new Date(filter.startDate) };
    } else if (filter.date) {
      query.date = filter.date;
    }

    if (filter.category) {
      query.category = filter.category;
    }

    let holidays = await Holiday.find(query).sort({ startAt: 1 }).lean();

    // Auto-seed if database is currently empty
    if (holidays.length === 0) {
      await HolidayService.syncPredefinedHolidays(filter.year || 2026);
      holidays = await Holiday.find(query).sort({ startAt: 1 }).lean();
    }

    return holidays;
  }

  /**
   * Administrator declares a scheduled or unexpected campus holiday.
   * Evaluates any existing active reservations that fall within the scope
   * and flags them for administrative review without silently deleting them.
   */
  static async declareCampusHoliday(payload, adminUser) {
    const {
      name,
      reason,
      startDate,
      endDate,
      scope = HolidayScope.CAMPUS_WIDE,
      affectedBlocks = [],
      affectedResources = [],
      category = HolidayCategory.INSTITUTIONAL,
      isUniversityClosed = true,
    } = payload;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      throw new BadRequestError('Holiday name is required and must be at least 2 characters');
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      throw new BadRequestError('A valid administrative reason (at least 5 characters) is required');
    }

    if (!startDate) {
      throw new BadRequestError('Start date (YYYY-MM-DD) is required');
    }

    const finalEndDate = endDate || startDate;

    const startAt = new Date(`${startDate}T00:00:00.000Z`);
    const endAt = new Date(`${finalEndDate}T23:59:59.999Z`);

    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || startAt > endAt) {
      throw new BadRequestError('Invalid date range for campus holiday declaration');
    }

    const year = startAt.getUTCFullYear();

    // Create the Holiday document
    const holiday = new Holiday({
      name: name.trim(),
      date: startDate,
      startAt,
      endAt,
      year,
      source: HolidaySource.ADMIN_DECLARED,
      category,
      scope,
      affectedBlocks: scope === HolidayScope.SPECIFIC_BLOCKS ? affectedBlocks : [],
      affectedResources: scope === HolidayScope.SPECIFIC_RESOURCES ? affectedResources : [],
      isUniversityClosed: Boolean(isUniversityClosed),
      reason: reason.trim(),
      status: HolidayStatus.PUBLISHED,
      createdBy: adminUser?._id || null,
      auditTrail: [
        {
          action: 'CREATED',
          performedBy: adminUser?._id || null,
          notes: `Declared by ${adminUser?.name || 'Administrator'}: ${reason.trim()}`,
        },
      ],
    });

    await holiday.save();

    // Detect and flag any existing active bookings that overlap this holiday
    // Active states: PENDING, CONFIRMED, CHECKED_IN
    const reservationQuery = {
      status: { $in: ACTIVE_RESERVATION_STATES },
      startAt: { $lte: endAt },
      endAt: { $gte: startAt },
    };

    if (scope === HolidayScope.SPECIFIC_RESOURCES && affectedResources.length > 0) {
      reservationQuery.resource = { $in: affectedResources };
    } else if (scope === HolidayScope.SPECIFIC_BLOCKS && affectedBlocks.length > 0) {
      // Find resources located in the affected blocks
      const matchingResources = await Resource.find({
        $or: [
          { block: { $in: affectedBlocks } },
          { 'location.building': { $in: affectedBlocks } },
        ],
      }).select('_id').lean();
      const resIds = matchingResources.map((r) => r._id);
      reservationQuery.resource = { $in: resIds };
    }

    const affectedBookings = await Reservation.find(reservationQuery).select('_id user resource startAt endAt title').lean();

    if (affectedBookings.length > 0) {
      const bookingIds = affectedBookings.map((b) => b._id);
      await Reservation.updateMany(
        { _id: { $in: bookingIds } },
        {
          $set: {
            'holidayReview.requiresReview': true,
            'holidayReview.holidayId': holiday._id,
            'holidayReview.reason': `Affected by declared holiday: "${name}" (${reason.trim()})`,
          },
        }
      );
      logger.info(
        `[HolidayService] Flagged ${affectedBookings.length} bookings for administrative review due to holiday "${name}"`
      );
    }

    return {
      holiday,
      affectedBookingsCount: affectedBookings.length,
      affectedBookings: affectedBookings.map((b) => ({
        id: b._id,
        title: b.title,
        startAt: b.startAt,
        endAt: b.endAt,
      })),
    };
  }

  /**
   * Revokes a future campus holiday.
   */
  static async revokeHoliday(holidayId, adminUser, revocationReason = '') {
    const holiday = await Holiday.findById(holidayId);
    if (!holiday) {
      throw new NotFoundError('Holiday not found');
    }

    if (holiday.status === HolidayStatus.REVOKED) {
      throw new BadRequestError('Holiday is already revoked');
    }

    holiday.status = HolidayStatus.REVOKED;
    holiday.auditTrail.push({
      action: 'REVOKED',
      performedBy: adminUser?._id || null,
      notes: revocationReason || `Revoked by ${adminUser?.name || 'Administrator'}`,
    });

    await holiday.save();

    // Release unreviewed holiday review flags
    await Reservation.updateMany(
      {
        'holidayReview.holidayId': holiday._id,
        'holidayReview.resolution': null,
      },
      {
        $set: {
          'holidayReview.requiresReview': false,
          'holidayReview.reason': 'Holiday declaration was subsequently revoked by administration',
        },
      }
    );

    return holiday;
  }

  /**
   * Evaluates whether a given timestamp interval and resource is blocked by a holiday.
   *
   * @param {Object} params
   * @param {Date} params.startAt - Reservation start timestamp (UTC).
   * @param {Date} params.endAt - Reservation end timestamp (UTC).
   * @param {Object} params.resource - Resource document (or lean object) being booked.
   * @returns {Promise<{ isBlocked: boolean, holiday: Object|null }>}
   */
  static async evaluateHolidayConflict({ startAt, endAt, resource }) {
    if (!startAt || !endAt || !resource) {
      return { isBlocked: false, holiday: null };
    }

    const startIsoDate = new Date(startAt).toISOString().slice(0, 10);
    const endIsoDate = new Date(endAt).toISOString().slice(0, 10);
    const targetYear = new Date(startAt).getUTCFullYear();

    // Find all active published holidays where the university is closed that overlap the requested interval
    const holidays = await Holiday.find({
      status: HolidayStatus.PUBLISHED,
      isUniversityClosed: true,
      $or: [
        { startAt: { $lt: endAt }, endAt: { $gt: startAt } },
        { date: { $gte: startIsoDate, $lte: endIsoDate } },
      ],
    }).lean();

    // Predefined catalog fallback if database is not yet synced or empty (offline-safe)
    if (holidays.length === 0) {
      const predefinedMatch = PREDEFINED_PUBLIC_HOLIDAYS.find(
        (h) => h.date >= startIsoDate && h.date <= endIsoDate
      );
      if (predefinedMatch) {
        // Trigger non-blocking background sync so DB gets populated
        HolidayService.syncPredefinedHolidays(targetYear).catch(() => {});

        return {
          isBlocked: true,
          holiday: {
            name: predefinedMatch.name,
            date: predefinedMatch.date,
            reason: `Official Public Holiday: ${predefinedMatch.name}`,
            category: predefinedMatch.category,
            scope: HolidayScope.CAMPUS_WIDE,
          },
        };
      }
    }

    for (const h of holidays) {
      if (h.scope === HolidayScope.CAMPUS_WIDE) {
        return { isBlocked: true, holiday: h };
      }

      if (h.scope === HolidayScope.SPECIFIC_RESOURCES) {
        const matchesResource = h.affectedResources?.some(
          (rId) => rId.toString() === resource._id.toString()
        );
        if (matchesResource) {
          return { isBlocked: true, holiday: h };
        }
      }

      if (h.scope === HolidayScope.SPECIFIC_BLOCKS) {
        const resBlock = resource.block || resource.location?.building;
        const matchesBlock = h.affectedBlocks?.some(
          (blk) => blk.toUpperCase() === (resBlock || '').toUpperCase()
        );
        if (matchesBlock) {
          return { isBlocked: true, holiday: h };
        }
      }
    }

    return { isBlocked: false, holiday: null };
  }
}
