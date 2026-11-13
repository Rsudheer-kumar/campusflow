/**
 * CampusFlow API - Phase 2 Unit Tests: Resource Catalogue (M1) & Availability Rules (M2)
 *
 * TEST ISOLATION:
 * Operates purely in-memory using Node.js native test runner and mocks without
 * requiring or connecting to any live MongoDB instance or external service.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ResourceService } from '../src/services/resource.service.js';
import { RuleAdminService } from '../src/services/ruleAdmin.service.js';
import { AvailabilityService } from '../src/services/availability.service.js';
import { QuotaService } from '../src/services/quota.service.js';
import { Resource, ResourceStatus } from '../src/models/resource.model.js';
import { ResourceType } from '../src/models/resourceType.model.js';
import { AvailabilityRule } from '../src/models/availabilityRule.model.js';
import { Blackout, BlackoutCategory } from '../src/models/blackout.model.js';
import { Quota, QuotaScopeType, QuotaSubjectType, QuotaMetric, QuotaPeriod } from '../src/models/quota.model.js';
import { User, UserRole } from '../src/models/user.model.js';
import {
  validatePhotoObject,
} from '../src/validators/resource.validator.js';
import {
  validateCreateAvailabilityRuleBody,
} from '../src/validators/ruleAdmin.validator.js';
import { ValidationError, ConflictError } from '../src/utils/errors.js';

describe('Phase 2: M1 Resource Catalogue & M2 Availability Rules', () => {
  const fakeTypeId = new mongoose.Types.ObjectId().toString();
  const fakeResourceId = new mongoose.Types.ObjectId().toString();

  /* ==========================================================================
     M1: RESOURCE CATALOGUE TESTS
     ========================================================================== */
  describe('M1: Resource Catalogue - Validation & Invariants', () => {
    it('should reject resource creation when referenced ResourceType is inactive', async () => {
      mock.method(ResourceType, 'findById', () => ({
        lean: async () => ({
          _id: fakeTypeId,
          name: 'Inactive Hall',
          code: 'INACT_HALL',
          isActive: false,
        }),
      }));

      await assert.rejects(
        async () => {
          await ResourceService.createResource({
            name: 'Room 101',
            code: 'RM101',
            resourceType: fakeTypeId,
            capacity: 50,
            location: { building: 'Science' },
          });
        },
        (err) => {
          assert.ok(err instanceof ValidationError);
          assert.match(err.message, /inactive and cannot be assigned/i);
          return true;
        }
      );
    });

    it('should reject resource update when assigned ResourceType is inactive', async () => {
      const mockResource = {
        _id: fakeResourceId,
        name: 'Room 101',
        code: 'RM101',
        resourceType: fakeTypeId,
        save: async () => mockResource,
      };

      mock.method(Resource, 'findById', async () => mockResource);
      mock.method(ResourceType, 'findById', () => ({
        lean: async () => ({
          _id: fakeTypeId,
          name: 'Retired Type',
          code: 'RET_TYPE',
          isActive: false,
        }),
      }));

      await assert.rejects(
        async () => {
          await ResourceService.updateResource(fakeResourceId, {
            resourceType: fakeTypeId,
          });
        },
        (err) => {
          assert.ok(err instanceof ValidationError);
          assert.match(err.message, /inactive and cannot be assigned/i);
          return true;
        }
      );
    });

    it('should enforce RETIRED status forces isActive: false', async () => {
      const mockDoc = {
        _id: fakeResourceId,
        name: 'Room 202',
        code: 'RM202',
        status: ResourceStatus.ACTIVE,
        isActive: true,
      };

      mock.method(Resource, 'findById', (id) => {
        if (id === fakeResourceId) {
          return {
            ...mockDoc,
            set status(val) { mockDoc.status = val; },
            get status() { return mockDoc.status; },
            set isActive(val) { mockDoc.isActive = val; },
            get isActive() { return mockDoc.isActive; },
            save: async () => mockDoc,
            populate: () => ({ lean: async () => mockDoc }),
          };
        }
        return {
          populate: () => ({ lean: async () => mockDoc }),
        };
      });

      await ResourceService.updateResource(fakeResourceId, {
        status: ResourceStatus.RETIRED,
      });

      assert.strictEqual(mockDoc.status, ResourceStatus.RETIRED);
      assert.strictEqual(mockDoc.isActive, false);
    });

    it('should reject setting isActive: true when resource status is RETIRED', async () => {
      const mockDoc = {
        _id: fakeResourceId,
        name: 'Room 202',
        code: 'RM202',
        status: ResourceStatus.RETIRED,
        isActive: false,
        save: async () => mockDoc,
      };

      mock.method(Resource, 'findById', async () => mockDoc);

      await assert.rejects(
        async () => {
          await ResourceService.updateResource(fakeResourceId, {
            isActive: true,
          });
        },
        (err) => {
          assert.ok(err instanceof ValidationError);
          assert.match(err.message, /retired resource cannot be active/i);
          return true;
        }
      );
    });

    it('should validate photo objects with URL format, size bounds, and captions', () => {
      const validUrlResult = validatePhotoObject({
        url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f',
        caption: 'Front Podium',
        isPrimary: true,
      });
      assert.strictEqual(validUrlResult.errors.length, 0);
      assert.strictEqual(validUrlResult.data.isPrimary, true);

      const invalidUrlResult = validatePhotoObject({
        url: 'ftp://invalidscheme.com/photo.jpg',
      });
      assert.ok(invalidUrlResult.errors.length > 0);
      assert.match(invalidUrlResult.errors[0].message, /valid HTTP\/HTTPS URL/i);

      const tooLongCaption = 'a'.repeat(250);
      const invalidCaptionResult = validatePhotoObject({
        url: 'https://example.com/test.jpg',
        caption: tooLongCaption,
      });
      assert.ok(invalidCaptionResult.errors.length > 0);
      assert.match(invalidCaptionResult.errors[0].message, /cannot exceed 200 characters/i);
    });

    it('should parse bulk CSV and report actionable row-level errors for duplicates and inactive types', async () => {
      const csv = `name,code,resourceType,capacity,building,floor,roomNumber,description
Lab Alpha,LAB-A,ACTIVE_TYPE,40,Tech Center,1,101,Standard lab
Lab Beta,LAB-B,INACTIVE_TYPE,30,Tech Center,1,102,Secondary lab
Lab Duplicate,LAB-A,ACTIVE_TYPE,25,Tech Center,1,103,Duplicate code row
Lab Invalid Cap,LAB-C,ACTIVE_TYPE,0,Tech Center,1,104,Invalid cap`;

      const activeTypeId = new mongoose.Types.ObjectId();
      const inactiveTypeId = new mongoose.Types.ObjectId();

      mock.method(ResourceType, 'find', () => ({
        lean: async () => [
          { _id: activeTypeId, code: 'ACTIVE_TYPE', name: 'Active Type', isActive: true },
          { _id: inactiveTypeId, code: 'INACTIVE_TYPE', name: 'Inactive Type', isActive: false },
        ],
      }));

      // Stub Resource save prototype to prevent unbuffered MongoDB insert in unit test
      mock.method(Resource.prototype, 'save', async function () {
        this._id = new mongoose.Types.ObjectId();
        return this;
      });

      mock.method(Resource, 'find', (query) => {
        if (query && query._id) {
          return {
            populate: () => ({
              lean: async () => [{ _id: new mongoose.Types.ObjectId(), code: 'LAB-A' }],
            }),
          };
        }
        return {
          lean: async () => [],
        };
      });

      const result = await ResourceService.bulkImportResources(csv);

      assert.strictEqual(result.totalRows, 4);
      assert.strictEqual(result.importedCount, 1);
      assert.strictEqual(result.failedCount, 3);

      const inactiveErr = result.errors.find((e) => e.row === 3);
      assert.ok(inactiveErr);
      assert.match(inactiveErr.message, /inactive and cannot be assigned/i);

      const duplicateErr = result.errors.find((e) => e.row === 4);
      assert.ok(duplicateErr);
      assert.match(duplicateErr.message, /duplicate resource code/i);

      const capErr = result.errors.find((e) => e.row === 5);
      assert.ok(capErr);
      assert.match(capErr.message, /capacity must be an integer >= 1/i);
    });
  });

  /* ==========================================================================
     M2: AVAILABILITY & RULES TESTS
     ========================================================================== */
  describe('M2: Availability & Operating Rules Evaluation', () => {
    it('should reject invalid IANA timezone and backward window times in rule validator', () => {
      const invalidTzResult = validateCreateAvailabilityRuleBody({
        resource: fakeResourceId,
        name: 'Engineering Labs',
        timezone: 'INVALID_ZONE',
        windows: [{ dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '18:00' }],
        bookingPolicy: { minDurationMinutes: 30, maxDurationMinutes: 120 },
      });
      assert.ok(invalidTzResult.errors.some((e) => e.field === 'timezone'));

      const backwardWindowResult = validateCreateAvailabilityRuleBody({
        resource: fakeResourceId,
        name: 'Engineering Labs',
        timezone: 'Asia/Kolkata',
        windows: [{ dayOfWeek: 'MONDAY', startTime: '18:00', endTime: '08:00' }],
        bookingPolicy: { minDurationMinutes: 30, maxDurationMinutes: 120 },
      });
      assert.ok(backwardWindowResult.errors.some((e) => e.field === 'windows[0]'));
    });

    it('should reject booking requests exceeding max duration or violating operating windows', async () => {
      const mockRule = {
        timezone: 'Asia/Kolkata',
        windows: [
          { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00' },
        ],
        bookingPolicy: {
          minDurationMinutes: 30,
          maxDurationMinutes: 120, // max 2 hours
          minLeadTimeMinutes: 0,
          maxAdvanceBookingDays: 30,
        },
      };

      mock.method(Resource, 'findById', () => ({
        session: () => ({
          lean: async () => ({
            _id: fakeResourceId,
            isActive: true,
            status: ResourceStatus.ACTIVE,
          }),
        }),
      }));

      mock.method(AvailabilityRule, 'find', () => ({
        session: () => ({
          lean: async () => [mockRule],
        }),
      }));

      // 1. Duration too long: 3 hours on Monday 10:00 to 13:00 (180 mins > 120 mins)
      const startAtLong = new Date('2026-10-19T04:30:00.000Z'); // 10:00 IST
      const endAtLong = new Date('2026-10-19T07:30:00.000Z');   // 13:00 IST

      const durationCheck = await AvailabilityService.checkAvailability({
        resourceId: fakeResourceId,
        startAt: startAtLong,
        endAt: endAtLong,
        now: new Date('2026-10-18T00:00:00.000Z'),
      });

      assert.strictEqual(durationCheck.available, false);
      assert.strictEqual(durationCheck.reason, 'DURATION_TOO_LONG');

      // 2. Outside operating hours: Monday 18:00 to 19:00 IST (operating window ends at 17:00 IST)
      const startAtOutside = new Date('2026-10-19T12:30:00.000Z'); // 18:00 IST
      const endAtOutside = new Date('2026-10-19T13:30:00.000Z');   // 19:00 IST

      const outsideCheck = await AvailabilityService.checkAvailability({
        resourceId: fakeResourceId,
        startAt: startAtOutside,
        endAt: endAtOutside,
        now: new Date('2026-10-18T00:00:00.000Z'),
      });

      assert.strictEqual(outsideCheck.available, false);
      assert.strictEqual(outsideCheck.reason, 'OUTSIDE_OPERATING_HOURS');
    });

    it('should detect and reject conflicting blackouts overlapping requested intervals', async () => {
      mock.method(Resource, 'findById', () => ({
        session: () => ({
          lean: async () => ({
            _id: fakeResourceId,
            isActive: true,
            status: ResourceStatus.ACTIVE,
          }),
        }),
      }));

      mock.method(AvailabilityRule, 'find', () => ({
        session: () => ({
          lean: async () => [
            {
              timezone: 'Asia/Kolkata',
              windows: [{ dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '20:00' }],
              bookingPolicy: {
                minDurationMinutes: 30,
                maxDurationMinutes: 240,
                minLeadTimeMinutes: 0,
                maxAdvanceBookingDays: 30,
              },
            },
          ],
        }),
      }));

      // Blackout covers 10:00 to 14:00 IST
      mock.method(Blackout, 'findOne', () => ({
        session: () => ({
          lean: async () => ({
            _id: new mongoose.Types.ObjectId(),
            reason: 'Emergency Electrical Maintenance',
            category: BlackoutCategory.ADMINISTRATIVE,
            startAt: new Date('2026-10-19T04:30:00.000Z'),
            endAt: new Date('2026-10-19T08:30:00.000Z'),
          }),
        }),
      }));

      const startAt = new Date('2026-10-19T05:00:00.000Z');
      const endAt = new Date('2026-10-19T06:00:00.000Z');

      const result = await AvailabilityService.checkAvailability({
        resourceId: fakeResourceId,
        startAt,
        endAt,
        now: new Date('2026-10-18T00:00:00.000Z'),
      });

      assert.strictEqual(result.available, false);
      assert.strictEqual(result.reason, 'BLACKOUT_CONFLICT');
      assert.match(result.message, /Emergency Electrical Maintenance/i);
    });

    it('should enforce departmental quota limits and reject exhausted quotas', async () => {
      const fakeUserId = new mongoose.Types.ObjectId();
      const fakeResourceTypeId = new mongoose.Types.ObjectId();

      mock.method(User, 'findById', () => ({
        session: () => ({
          lean: async () => ({
            _id: fakeUserId,
            department: 'Computer Science and Engineering',
            roles: [UserRole.STUDENT],
            isActive: true,
          }),
        }),
      }));

      mock.method(Resource, 'findById', () => ({
        session: () => ({
          lean: async () => ({
            _id: fakeResourceId,
            resourceType: fakeResourceTypeId,
            isActive: true,
          }),
        }),
      }));

      // Active weekly quota of 120 minutes (2 hours) for CS department
      const mockQuota = {
        _id: new mongoose.Types.ObjectId(),
        name: 'CS Weekly Limit',
        scopeType: QuotaScopeType.RESOURCE_TYPE,
        resourceType: fakeResourceTypeId,
        subjectType: QuotaSubjectType.DEPARTMENT,
        department: 'Computer Science and Engineering',
        metric: QuotaMetric.DURATION_MINUTES,
        period: QuotaPeriod.WEEKLY,
        limit: 120, // 2 hours cap
        timezone: 'Asia/Kolkata',
        isActive: true,
      };

      mock.method(Quota, 'find', () => ({
        session: () => ({
          lean: async () => [mockQuota],
        }),
      }));

      // Mock calculateConsumedUsage returning 100 minutes already used
      mock.method(QuotaService, 'calculateConsumedUsage', async () => 100);

      // Attempting to book 60 minutes (100 + 60 = 160 > 120 limit)
      const startAt = new Date('2026-10-19T04:30:00.000Z');
      const endAt = new Date('2026-10-19T05:30:00.000Z');

      const evaluation = await QuotaService.evaluateQuotas({
        userId: fakeUserId,
        resourceId: fakeResourceId,
        startAt,
        endAt,
      });

      assert.strictEqual(evaluation.allowed, false);
      assert.ok(evaluation.violation);
      assert.strictEqual(evaluation.violation.quotaName, 'CS Weekly Limit');
      assert.strictEqual(evaluation.violation.consumed, 100);
      assert.strictEqual(evaluation.violation.requested, 60);
      assert.strictEqual(evaluation.violation.limit, 120);
    });

    it('should validate blackout intervals: startAt < endAt and unique intervals', async () => {
      mock.method(Resource, 'findById', () => ({
        lean: async () => ({
          _id: fakeResourceId,
          name: 'Seminar Hall A',
          isActive: true,
        }),
      }));

      mock.method(Blackout, 'findOne', () => ({
        lean: async () => ({
          _id: new mongoose.Types.ObjectId(),
          reason: 'Existing Holiday',
        }),
      }));

      const startAt = new Date('2026-11-01T00:00:00.000Z');
      const endAt = new Date('2026-11-02T00:00:00.000Z');

      await assert.rejects(
        async () => {
          await RuleAdminService.createBlackout({
            resource: fakeResourceId,
            reason: 'Duplicate Holiday',
            category: BlackoutCategory.HOLIDAY,
            startAt,
            endAt,
          });
        },
        (err) => {
          assert.ok(err instanceof ConflictError);
          assert.match(err.message, /active blackout already exists/i);
          return true;
        }
      );
    });
  });
});
