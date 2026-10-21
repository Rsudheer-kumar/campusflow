/**
 * CampusFlow API - Phase 3 Unit Tests: Digital Twin Building Availability Engine
 *
 * TEST ISOLATION & SAFETY GUARANTEE:
 * Operates purely in-memory using Node.js native test runner and mocks without
 * connecting to or modifying any database. Never touches port 27017.
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { AvailabilityService } from '../src/services/availability.service.js';
import { QuotaService } from '../src/services/quota.service.js';
import {
  Resource,
  ResourceStatus,
  AvailabilityRule,
  Blackout,
  Reservation,
  TimetableEntry,
  UserRole,
} from '../src/models/index.js';
import { validateBuildingAvailabilityQuery } from '../src/validators/booking.validator.js';
import { getBuildingAvailability } from '../src/controllers/booking.controller.js';
import { ForbiddenError, BadRequestError, NotFoundError } from '../src/utils/errors.js';

describe('Phase 3: Digital Twin Building Availability & Status Engine', () => {
  const buildingName = 'Turing Science Center';
  const resourceId1 = new mongoose.Types.ObjectId();
  const resourceId2 = new mongoose.Types.ObjectId();
  const resourceId3 = new mongoose.Types.ObjectId();
  const resourceTypeId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId().toString();
  const otherStudentId = new mongoose.Types.ObjectId().toString();
  const adminId = new mongoose.Types.ObjectId().toString();

  const baseRule = {
    _id: new mongoose.Types.ObjectId(),
    resource: resourceId1,
    timezone: 'UTC',
    windows: [
      { dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '20:00' },
      { dayOfWeek: 'TUESDAY', startTime: '08:00', endTime: '20:00' },
      { dayOfWeek: 'WEDNESDAY', startTime: '08:00', endTime: '20:00' },
      { dayOfWeek: 'THURSDAY', startTime: '08:00', endTime: '20:00' },
      { dayOfWeek: 'FRIDAY', startTime: '08:00', endTime: '20:00' },
      { dayOfWeek: 'SATURDAY', startTime: '08:00', endTime: '20:00' },
      { dayOfWeek: 'SUNDAY', startTime: '08:00', endTime: '20:00' },
    ],
    bookingPolicy: {
      minDurationMinutes: 30,
      maxDurationMinutes: 240,
      minLeadTimeMinutes: 0,
      maxAdvanceBookingDays: 30,
    },
    isActive: true,
  };

  /* ==========================================================================
     1. QUERY VALIDATOR TESTS
     ========================================================================== */
  describe('Query Validation (validateBuildingAvailabilityQuery)', () => {
    it('should validate a correct building query payload', () => {
      const validQuery = {
        building: 'Turing Science Center',
        startAt: '2026-10-19T09:00:00.000Z',
        endAt: '2026-10-19T11:00:00.000Z',
        timezone: 'Asia/Kolkata',
        limit: '25',
      };
      const result = validateBuildingAvailabilityQuery(validQuery);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.building, 'Turing Science Center');
      assert.strictEqual(result.data.limit, 25);
      assert.strictEqual(result.data.timezone, 'Asia/Kolkata');
      assert.ok(result.data.startAt instanceof Date);
      assert.ok(result.data.endAt instanceof Date);
    });

    it('should reject missing building parameter', () => {
      const result = validateBuildingAvailabilityQuery({
        startAt: '2026-10-19T09:00:00.000Z',
        endAt: '2026-10-19T11:00:00.000Z',
      });
      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some((e) => e.field === 'building'));
    });

    it('should reject invalid or inverted date interval (startAt >= endAt)', () => {
      const result = validateBuildingAvailabilityQuery({
        building: 'Turing Science Center',
        startAt: '2026-10-19T12:00:00.000Z',
        endAt: '2026-10-19T10:00:00.000Z',
      });
      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some((e) => e.field === 'startAt'));
    });

    it('should reject limit exceeding max of 50', () => {
      const result = validateBuildingAvailabilityQuery({
        building: 'Turing Science Center',
        startAt: '2026-10-19T09:00:00.000Z',
        endAt: '2026-10-19T11:00:00.000Z',
        limit: '100',
      });
      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some((e) => e.field === 'limit'));
    });

    it('should reject invalid IANA timezone', () => {
      const result = validateBuildingAvailabilityQuery({
        building: 'Turing Science Center',
        startAt: '2026-10-19T09:00:00.000Z',
        endAt: '2026-10-19T11:00:00.000Z',
        timezone: 'Invalid/NonExistent_Zone',
      });
      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some((e) => e.field === 'timezone'));
    });
  });

  /* ==========================================================================
     2. BATCH AVAILABILITY ENGINE & STATUS PRECEDENCE TESTS
     ========================================================================== */
  describe('Batch Availability Engine & Status Precedence', () => {
    // Dynamic future test date (2 days ahead) to prevent lead-time expiry as calendar advances
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const dateStr = futureDate.toISOString().slice(0, 10);
    const queryStart = new Date(`${dateStr}T10:00:00.000Z`);
    const queryEnd = new Date(`${dateStr}T12:00:00.000Z`);

    it('T-DT-01: should mark resource as occupied (Amber) on overlapping reservation', async () => {
      const mockResource = {
        _id: resourceId1,
        name: 'Turing Lecture Hall',
        code: 'LH-101',
        capacity: 120,
        status: ResourceStatus.ACTIVE,
        isActive: true,
        location: { building: buildingName, floor: '1', roomNumber: '101' },
      };

      mock.method(Resource, 'find', () => ({
        populate: () => ({
          limit: () => ({
            lean: async () => [mockResource],
          }),
        }),
      }));
      mock.method(AvailabilityRule, 'find', () => ({
        lean: async () => [{ ...baseRule, resource: resourceId1 }],
      }));
      mock.method(Blackout, 'find', () => ({ lean: async () => [] }));
      mock.method(TimetableEntry, 'find', () => ({ lean: async () => [] }));
      mock.method(Reservation, 'find', () => ({
        lean: async () => [
          {
            _id: new mongoose.Types.ObjectId(),
            resource: resourceId1,
            startAt: new Date(queryStart.getTime() - 30 * 60 * 1000),
            endAt: new Date(queryStart.getTime() + 30 * 60 * 1000),
            status: 'CONFIRMED',
          },
        ],
        sort: () => ({ lean: async () => [] }),
      }));

      const res = await AvailabilityService.checkBuildingAvailability({
        building: buildingName,
        startAt: queryStart,
        endAt: queryEnd,
      });

      assert.ok(res);


      assert.strictEqual(res.summary.counts.occupied, 1);
      assert.strictEqual(res.summary.counts.available, 0);
      assert.strictEqual(res.resources[0].availability.available, false);
      assert.strictEqual(res.resources[0].availability.visualStatus, 'occupied');
      assert.strictEqual(res.resources[0].availability.reason, 'RESERVATION_CONFLICT');
    });

    it('T-DT-02: should allow adjacent back-to-back reservation without collision', async () => {
      const mockResource = {
        _id: resourceId1,
        name: 'Turing Lecture Hall',
        code: 'LH-101',
        capacity: 120,
        status: ResourceStatus.ACTIVE,
        isActive: true,
        location: { building: buildingName, floor: '1', roomNumber: '101' },
      };

      mock.method(Resource, 'find', () => ({
        populate: () => ({
          limit: () => ({
            lean: async () => [mockResource],
          }),
        }),
      }));
      mock.method(AvailabilityRule, 'find', () => ({
        lean: async () => [{ ...baseRule, resource: resourceId1 }],
      }));
      mock.method(Blackout, 'find', () => ({ lean: async () => [] }));
      mock.method(TimetableEntry, 'find', () => ({ lean: async () => [] }));
      // Existing booking ends exactly at 10:00:00 (adjacent to query start at 10:00:00)
      mock.method(Reservation, 'find', () => ({
        lean: async () => [],
        sort: () => ({ lean: async () => [] }),
      }));

      const res = await AvailabilityService.checkBuildingAvailability({
        building: buildingName,
        startAt: queryStart,
        endAt: queryEnd,
      });

      assert.ok(res);
      assert.strictEqual(res.summary.counts.available, 1);
      assert.strictEqual(res.resources[0].availability.available, true);
      assert.strictEqual(res.resources[0].availability.visualStatus, 'available');
    });

    it('T-DT-03: should enforce maintenance precedence (Red) over active calendar', async () => {
      const mockResource = {
        _id: resourceId1,
        name: 'Turing Lecture Hall',
        code: 'LH-101',
        capacity: 120,
        status: ResourceStatus.MAINTENANCE,
        isActive: true,
        location: { building: buildingName, floor: '1', roomNumber: '101' },
      };

      mock.method(Resource, 'find', () => ({
        populate: () => ({
          limit: () => ({
            lean: async () => [mockResource],
          }),
        }),
      }));
      mock.method(AvailabilityRule, 'find', () => ({ lean: async () => [{ ...baseRule, resource: resourceId1 }] }));
      mock.method(Blackout, 'find', () => ({ lean: async () => [] }));
      mock.method(TimetableEntry, 'find', () => ({ lean: async () => [] }));
      mock.method(Reservation, 'find', () => ({
        lean: async () => [],
        sort: () => ({ lean: async () => [] }),
      }));

      const res = await AvailabilityService.checkBuildingAvailability({
        building: buildingName,
        startAt: queryStart,
        endAt: queryEnd,
      });

      assert.ok(res);
      assert.strictEqual(res.summary.counts.maintenance, 1);
      assert.strictEqual(res.summary.counts.available, 0);
      assert.strictEqual(res.resources[0].availability.available, false);
      assert.strictEqual(res.resources[0].availability.visualStatus, 'maintenance');
      assert.strictEqual(res.resources[0].availability.reason, 'RESOURCE_UNAVAILABLE');
    });

    it('T-DT-04: should mark inactive or retired resources as unavailable (Grey)', async () => {
      const mockResource = {
        _id: resourceId1,
        name: 'Old Lab',
        code: 'OLD-101',
        capacity: 30,
        status: ResourceStatus.RETIRED,
        isActive: false,
        location: { building: buildingName, floor: '1', roomNumber: '101' },
      };

      mock.method(Resource, 'find', () => ({
        populate: () => ({
          limit: () => ({
            lean: async () => [mockResource],
          }),
        }),
      }));
      mock.method(AvailabilityRule, 'find', () => ({ lean: async () => [] }));
      mock.method(Blackout, 'find', () => ({ lean: async () => [] }));
      mock.method(TimetableEntry, 'find', () => ({ lean: async () => [] }));
      mock.method(Reservation, 'find', () => ({
        lean: async () => [],
        sort: () => ({ lean: async () => [] }),
      }));

      const res = await AvailabilityService.checkBuildingAvailability({
        building: buildingName,
        startAt: queryStart,
        endAt: queryEnd,
      });

      assert.ok(res);
      assert.strictEqual(res.summary.counts.unavailable, 1);
      assert.strictEqual(res.resources[0].availability.available, false);
      assert.strictEqual(res.resources[0].availability.visualStatus, 'unavailable');
    });

    it('T-DT-05: should mark blackout conflict as unavailable (Grey)', async () => {
      const mockResource = {
        _id: resourceId1,
        name: 'Turing Lecture Hall',
        code: 'LH-101',
        capacity: 120,
        status: ResourceStatus.ACTIVE,
        isActive: true,
        location: { building: buildingName, floor: '1', roomNumber: '101' },
      };

      mock.method(Resource, 'find', () => ({
        populate: () => ({
          limit: () => ({
            lean: async () => [mockResource],
          }),
        }),
      }));
      mock.method(AvailabilityRule, 'find', () => ({ lean: async () => [{ ...baseRule, resource: resourceId1 }] }));
      mock.method(Blackout, 'find', () => ({
        lean: async () => [
          {
            _id: new mongoose.Types.ObjectId(),
            resource: resourceId1,
            startAt: new Date(queryStart.getTime() - 2 * 3600 * 1000),
            endAt: new Date(queryStart.getTime() + 3 * 3600 * 1000),
            reason: 'Campus Holiday Closure',
            category: 'HOLIDAY',
          },
        ],
      }));
      mock.method(TimetableEntry, 'find', () => ({ lean: async () => [] }));
      mock.method(Reservation, 'find', () => ({
        lean: async () => [],
        sort: () => ({ lean: async () => [] }),
      }));

      const res = await AvailabilityService.checkBuildingAvailability({
        building: buildingName,
        startAt: queryStart,
        endAt: queryEnd,
      });

      assert.ok(res);
      assert.strictEqual(res.summary.counts.unavailable, 1);
      assert.strictEqual(res.resources[0].availability.available, false);
      assert.strictEqual(res.resources[0].availability.visualStatus, 'unavailable');
      assert.strictEqual(res.resources[0].availability.reason, 'BLACKOUT_CONFLICT');
    });

    it('T-DT-06: should mark timetable conflict as unavailable (Grey)', async () => {
      const mockResource = {
        _id: resourceId1,
        name: 'Turing Lecture Hall',
        code: 'LH-101',
        capacity: 120,
        status: ResourceStatus.ACTIVE,
        isActive: true,
        location: { building: buildingName, floor: '1', roomNumber: '101' },
      };

      mock.method(Resource, 'find', () => ({
        populate: () => ({
          limit: () => ({
            lean: async () => [mockResource],
          }),
        }),
      }));
      mock.method(AvailabilityRule, 'find', () => ({ lean: async () => [{ ...baseRule, resource: resourceId1 }] }));
      mock.method(Blackout, 'find', () => ({ lean: async () => [] }));
      mock.method(TimetableEntry, 'find', () => ({
        lean: async () => [
          {
            _id: new mongoose.Types.ObjectId(),
            resource: resourceId1,
            startAt: new Date(queryStart.getTime()),
            endAt: new Date(queryStart.getTime() + 90 * 60 * 1000),
            isPublished: true,
          },
        ],
      }));
      mock.method(Reservation, 'find', () => ({
        lean: async () => [],
        sort: () => ({ lean: async () => [] }),
      }));

      const res = await AvailabilityService.checkBuildingAvailability({
        building: buildingName,
        startAt: queryStart,
        endAt: queryEnd,
      });

      assert.ok(res);
      assert.strictEqual(res.summary.counts.unavailable, 1);
      assert.strictEqual(res.resources[0].availability.available, false);
      assert.strictEqual(res.resources[0].availability.visualStatus, 'unavailable');
      assert.strictEqual(res.resources[0].availability.reason, 'TIMETABLE_CONFLICT');
    });

    it('T-DT-07: should mark missing availability rule as unknown (Grey Striped)', async () => {
      const mockResource = {
        _id: resourceId1,
        name: 'Unconfigured Room',
        code: 'UNCONF-101',
        capacity: 20,
        status: ResourceStatus.ACTIVE,
        isActive: true,
        location: { building: buildingName, floor: '1', roomNumber: '101' },
      };

      mock.method(Resource, 'find', () => ({
        populate: () => ({
          limit: () => ({
            lean: async () => [mockResource],
          }),
        }),
      }));
      // 0 active rules configured
      mock.method(AvailabilityRule, 'find', () => ({ lean: async () => [] }));
      mock.method(Blackout, 'find', () => ({ lean: async () => [] }));
      mock.method(TimetableEntry, 'find', () => ({ lean: async () => [] }));
      mock.method(Reservation, 'find', () => ({
        lean: async () => [],
        sort: () => ({ lean: async () => [] }),
      }));

      const res = await AvailabilityService.checkBuildingAvailability({
        building: buildingName,
        startAt: queryStart,
        endAt: queryEnd,
      });

      assert.ok(res);
      assert.strictEqual(res.summary.counts.unknown, 1);
      assert.strictEqual(res.resources[0].availability.available, false);
      assert.strictEqual(res.resources[0].availability.visualStatus, 'unknown');
      assert.strictEqual(res.resources[0].availability.reason, 'NO_AVAILABILITY_RULE');
    });

    it('T-DT-08: should display occupied_soon UX modifier when next reservation is within 30m', async () => {
      const mockResource = {
        _id: resourceId1,
        name: 'Turing Lecture Hall',
        code: 'LH-101',
        capacity: 120,
        status: ResourceStatus.ACTIVE,
        isActive: true,
        location: { building: buildingName, floor: '1', roomNumber: '101' },
      };

      mock.method(Resource, 'find', () => ({
        populate: () => ({
          limit: () => ({
            lean: async () => [mockResource],
          }),
        }),
      }));
      mock.method(AvailabilityRule, 'find', () => ({ lean: async () => [{ ...baseRule, resource: resourceId1 }] }));
      mock.method(Blackout, 'find', () => ({ lean: async () => [] }));
      mock.method(TimetableEntry, 'find', () => ({ lean: async () => [] }));
      // Free during [10:00, 12:00), but upcoming booking at 12:15 (within 30 min of endAt)
      mock.method(Reservation, 'find', () => ({
        lean: async () => [],
        sort: () => ({
          lean: async () => [
            {
              _id: new mongoose.Types.ObjectId(),
              resource: resourceId1,
              startAt: new Date(queryEnd.getTime() + 15 * 60 * 1000),
              endAt: new Date(queryEnd.getTime() + 120 * 60 * 1000),
            },
          ],
        }),
      }));

      const res = await AvailabilityService.checkBuildingAvailability({
        building: buildingName,
        startAt: queryStart,
        endAt: queryEnd,
      });

      assert.ok(res);
      assert.strictEqual(res.summary.counts.available, 1);
      assert.strictEqual(res.resources[0].availability.available, true);
      assert.strictEqual(res.resources[0].availability.visualStatus, 'occupied_soon');
      assert.strictEqual(res.resources[0].availability.occupiedSoon, true);
      assert.strictEqual(
        res.resources[0].availability.nextBookingAt,
        new Date(queryEnd.getTime() + 15 * 60 * 1000).toISOString()
      );
    });

    it('T-DT-09: should mark quota exceeded as unavailable (Grey) for authenticated user', async () => {
      const mockResource = {
        _id: resourceId1,
        name: 'Turing Lecture Hall',
        code: 'LH-101',
        capacity: 120,
        status: ResourceStatus.ACTIVE,
        isActive: true,
        location: { building: buildingName, floor: '1', roomNumber: '101' },
      };

      mock.method(Resource, 'find', () => ({
        populate: () => ({
          limit: () => ({
            lean: async () => [mockResource],
          }),
        }),
      }));
      mock.method(AvailabilityRule, 'find', () => ({ lean: async () => [{ ...baseRule, resource: resourceId1 }] }));
      mock.method(Blackout, 'find', () => ({ lean: async () => [] }));
      mock.method(TimetableEntry, 'find', () => ({ lean: async () => [] }));
      mock.method(Reservation, 'find', () => ({
        lean: async () => [],
        sort: () => ({ lean: async () => [] }),
      }));
      mock.method(QuotaService, 'evaluateQuotas', async () => ({
        allowed: false,
        violation: { message: 'Daily quota limit of 120 minutes exceeded' },
      }));

      const res = await AvailabilityService.checkBuildingAvailability({
        building: buildingName,
        startAt: queryStart,
        endAt: queryEnd,
        userId: studentId,
      });

      assert.ok(res);
      assert.strictEqual(res.summary.counts.unavailable, 1);
      assert.strictEqual(res.resources[0].availability.available, false);
      assert.strictEqual(res.resources[0].availability.visualStatus, 'unavailable');
      assert.strictEqual(res.resources[0].availability.reason, 'QUOTA_EXCEEDED');
      assert.strictEqual(res.resources[0].availability.quota.allowed, false);
    });

    it('T-DT-10: technical failures must fail closed and NEVER produce a blue marker', async () => {
      const mockResource = {
        _id: resourceId1,
        name: 'Faulty Facility',
        code: 'FAULT-01',
        capacity: 50,
        status: ResourceStatus.ACTIVE,
        isActive: true,
        location: { building: buildingName, floor: '1', roomNumber: '101' },
      };

      mock.method(Resource, 'find', () => ({
        populate: () => ({
          limit: () => ({
            lean: async () => [mockResource],
          }),
        }),
      }));
      // Simulating corrupt timezone on rule that triggers calculation throw
      mock.method(AvailabilityRule, 'find', () => ({
        lean: async () => [
          {
            _id: new mongoose.Types.ObjectId(),
            resource: resourceId1,
            timezone: 'Corrupt/NonExistent_Zone',
            windows: [{ dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '20:00' }],
            isActive: true,
          },
        ],
      }));
      mock.method(Blackout, 'find', () => ({ lean: async () => [] }));
      mock.method(TimetableEntry, 'find', () => ({ lean: async () => [] }));
      mock.method(Reservation, 'find', () => ({
        lean: async () => [],
        sort: () => ({ lean: async () => [] }),
      }));

      const res = await AvailabilityService.checkBuildingAvailability({
        building: buildingName,
        startAt: queryStart,
        endAt: queryEnd,
      });

      assert.ok(res);
      // Critical fail-closed verification:
      assert.strictEqual(res.resources[0].availability.available, false, 'Must be available: false');
      assert.notStrictEqual(res.resources[0].availability.visualStatus, 'available', 'Must NOT produce blue available status');
      assert.strictEqual(res.resources[0].availability.visualStatus, 'unknown', 'Must resolve to unknown');
      assert.strictEqual(res.resources[0].availability.reason, 'CALCULATION_ERROR');
      assert.strictEqual(res.summary.counts.unknown, 1);
    });

    it('T-DT-11: building-level aggregation exposes accurate counts without false whole-building availability', async () => {
      const res1 = {
        _id: resourceId1,
        name: 'Room 1 (Free)',
        status: ResourceStatus.ACTIVE,
        isActive: true,
        location: { building: buildingName, floor: '1', roomNumber: '101' },
      };
      const res2 = {
        _id: resourceId2,
        name: 'Room 2 (Occupied)',
        status: ResourceStatus.ACTIVE,
        isActive: true,
        location: { building: buildingName, floor: '1', roomNumber: '102' },
      };
      const res3 = {
        _id: resourceId3,
        name: 'Room 3 (Maint)',
        status: ResourceStatus.MAINTENANCE,
        isActive: true,
        location: { building: buildingName, floor: '2', roomNumber: '201' },
      };

      mock.method(Resource, 'find', () => ({
        populate: () => ({
          limit: () => ({
            lean: async () => [res1, res2, res3],
          }),
        }),
      }));
      mock.method(AvailabilityRule, 'find', () => ({
        lean: async () => [
          { ...baseRule, resource: resourceId1 },
          { ...baseRule, resource: resourceId2 },
        ],
      }));
      mock.method(Blackout, 'find', () => ({ lean: async () => [] }));
      mock.method(TimetableEntry, 'find', () => ({ lean: async () => [] }));
      // Room 2 has an active reservation
      mock.method(Reservation, 'find', () => ({
        lean: async () => [
          {
            _id: new mongoose.Types.ObjectId(),
            resource: resourceId2,
            startAt: queryStart,
            endAt: queryEnd,
            status: 'CONFIRMED',
          },
        ],
        sort: () => ({ lean: async () => [] }),
      }));

      const res = await AvailabilityService.checkBuildingAvailability({
        building: buildingName,
        startAt: queryStart,
        endAt: queryEnd,
      });

      assert.ok(res);
      assert.strictEqual(res.summary.total, 3);
      assert.strictEqual(res.summary.counts.available, 1);
      assert.strictEqual(res.summary.counts.occupied, 1);
      assert.strictEqual(res.summary.counts.maintenance, 1);
      assert.strictEqual(res.summary.counts.unavailable, 0);
      assert.strictEqual(res.summary.counts.unknown, 0);
      // Aggregate building state: partially available, never claims whole building is available
      assert.strictEqual(res.summary.buildingVisualState, 'partially_available');
      assert.strictEqual(res.summary.displayBadge, '1 of 3 Facilities Available');
    });

    it('T-DT-12: returns null when building has no registered resources', async () => {
      mock.method(Resource, 'find', () => ({
        populate: () => ({
          limit: () => ({
            lean: async () => [],
          }),
        }),
      }));

      const res = await AvailabilityService.checkBuildingAvailability({
        building: 'Unknown Building',
        startAt: queryStart,
        endAt: queryEnd,
      });

      assert.strictEqual(res, null);
    });
  });

  /* ==========================================================================
     3. CONTROLLER & AUTHORIZATION IDENTITY SECURITY TESTS
     ========================================================================== */
  describe('Controller & Identity Security (getBuildingAvailability)', () => {
    it('T-DT-13: student attempting to query another student userId is rejected with 403 Forbidden', async () => {
      const req = {
        query: {
          building: buildingName,
          startAt: '2026-10-19T10:00:00.000Z',
          endAt: '2026-10-19T12:00:00.000Z',
          userId: otherStudentId, // Impersonation attempt
        },
        user: {
          id: studentId,
          roles: [UserRole.STUDENT],
        },
      };
      const res = {};
      let caughtError = null;
      const next = (err) => {
        caughtError = err;
      };

      await getBuildingAvailability(req, res, next);
      assert.ok(caughtError instanceof ForbiddenError);
      assert.match(caughtError.message, /not authorized to evaluate quota for another user/i);
    });

    it('T-DT-14: unauthenticated client supplying a userId is rejected with 400 Bad Request', async () => {
      const req = {
        query: {
          building: buildingName,
          startAt: '2026-10-19T10:00:00.000Z',
          endAt: '2026-10-19T12:00:00.000Z',
          userId: studentId,
        },
        user: undefined, // Unauthenticated
      };
      const res = {};
      let caughtError = null;
      const next = (err) => {
        caughtError = err;
      };

      await getBuildingAvailability(req, res, next);
      assert.ok(caughtError instanceof BadRequestError);
      assert.match(caughtError.message, /unauthenticated requests cannot provide a userid/i);
    });

    it('T-DT-15: admin user is permitted to query on behalf of another user', async () => {
      const req = {
        query: {
          building: buildingName,
          startAt: '2026-10-19T10:00:00.000Z',
          endAt: '2026-10-19T12:00:00.000Z',
          userId: studentId,
        },
        user: {
          id: adminId,
          roles: [UserRole.ADMIN],
        },
      };
      let sentData = null;
      const res = {
        status: () => res,
        json: (payload) => {
          sentData = payload;
        },
      };
      let caughtError = null;
      const next = (err) => {
        caughtError = err;
      };

      // Mock AvailabilityService to return a mock building
      mock.method(AvailabilityService, 'checkBuildingAvailability', async (params) => {
        assert.strictEqual(params.userId, studentId, 'Admin must be permitted to inspect student quota');
        return {
          building: buildingName,
          summary: { total: 1, counts: { available: 1 } },
          resources: [],
        };
      });

      await getBuildingAvailability(req, res, next);
      assert.strictEqual(caughtError, null);
      assert.ok(sentData);
      assert.strictEqual(sentData.success, true);
    });
  });
});
