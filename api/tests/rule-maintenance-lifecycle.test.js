/**
 * CampusFlow API - Unit Tests: Availability Rule Maintenance Lifecycle & Confidentiality
 *
 * TEST ISOLATION:
 * Operates purely in-memory using Node.js native test runner and mocks without
 * requiring or connecting to any live MongoDB instance or external service.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { RuleAdminService } from '../src/services/ruleAdmin.service.js';
import { AvailabilityService } from '../src/services/availability.service.js';
import { AvailabilityRule } from '../src/models/availabilityRule.model.js';
import { Blackout } from '../src/models/blackout.model.js';
import { TimetableEntry } from '../src/models/timetableEntry.model.js';
import { Reservation } from '../src/models/reservation.model.js';
import { Resource, ResourceStatus } from '../src/models/resource.model.js';
import {
  validateCreateAvailabilityRuleBody,
  validateUpdateAvailabilityRuleBody,
} from '../src/validators/ruleAdmin.validator.js';

describe('Availability Rule Maintenance Lifecycle & Privacy', () => {
  const fakeResourceId = new mongoose.Types.ObjectId().toString();
  const fakeRuleId = new mongoose.Types.ObjectId().toString();

  it('1. validateUpdateAvailabilityRuleBody accepts valid deactivationReason', () => {
    const valid = validateUpdateAvailabilityRuleBody({
      deactivationReason: 'Scheduled HVAC duct replacement',
    });
    assert.equal(valid.success, true);
    assert.equal(valid.data.deactivationReason, 'Scheduled HVAC duct replacement');
  });

  it('2. validateUpdateAvailabilityRuleBody rejects oversized deactivationReason > 500 chars', () => {
    const invalid = validateUpdateAvailabilityRuleBody({
      deactivationReason: 'x'.repeat(501),
    });
    assert.equal(invalid.success, false);
    assert.ok(invalid.errors.some((e) => e.field === 'deactivationReason'));
  });

  it('3. deleteAvailabilityRule sets isActive: false, saves deactivationReason, and sets Resource status to MAINTENANCE', async () => {
    const mockRuleDoc = {
      _id: fakeRuleId,
      resource: fakeResourceId,
      isActive: true,
      deactivationReason: null,
      save: mock.fn(async () => {}),
      populate: () => ({
        lean: async () => ({
          _id: fakeRuleId,
          resource: { _id: fakeResourceId, name: 'Turing Hall', code: 'TUR-101' },
          isActive: mockRuleDoc.isActive,
          deactivationReason: mockRuleDoc.deactivationReason,
        }),
      }),
    };

    mock.method(AvailabilityRule, 'findById', (id) => {
      return mockRuleDoc;
    });

    let updatedResourceStatus = null;
    mock.method(Resource, 'findByIdAndUpdate', async (resId, update) => {
      if (resId.toString() === fakeResourceId) {
        updatedResourceStatus = update.status;
      }
      return { _id: resId, status: update.status };
    });

    const result = await RuleAdminService.deleteAvailabilityRule(fakeRuleId, 'Annual HVAC Inspection');

    assert.equal(result.success, true);
    assert.equal(mockRuleDoc.isActive, false);
    assert.equal(mockRuleDoc.deactivationReason, 'Annual HVAC Inspection');
    assert.equal(updatedResourceStatus, ResourceStatus.MAINTENANCE);
  });

  it('4. activateAvailabilityRule restores isActive: true, clears deactivationReason, and restores Resource status to ACTIVE', async () => {
    const mockRuleDoc = {
      _id: fakeRuleId,
      resource: fakeResourceId,
      isActive: false,
      deactivationReason: 'Annual HVAC Inspection',
      save: mock.fn(async () => {}),
      populate: () => ({
        lean: async () => ({
          _id: fakeRuleId,
          resource: { _id: fakeResourceId, name: 'Turing Hall', code: 'TUR-101' },
          isActive: mockRuleDoc.isActive,
          deactivationReason: mockRuleDoc.deactivationReason,
        }),
      }),
    };

    mock.method(AvailabilityRule, 'findById', (id) => {
      return mockRuleDoc;
    });

    let updatedResourceStatus = null;
    mock.method(Resource, 'findByIdAndUpdate', async (resId, update) => {
      if (resId.toString() === fakeResourceId) {
        updatedResourceStatus = update.status;
      }
      return { _id: resId, status: update.status };
    });

    const result = await RuleAdminService.activateAvailabilityRule(fakeRuleId);

    assert.equal(result.success, true);
    assert.equal(mockRuleDoc.isActive, true);
    assert.equal(mockRuleDoc.deactivationReason, null);
    assert.equal(updatedResourceStatus, ResourceStatus.ACTIVE);
  });

  it('5. Building availability check returns status: "maintenance" and hides internal reason from students/faculty', async () => {
    mock.method(Resource, 'find', () => ({
      populate: () => ({
        limit: () => ({
          lean: async () => [
            {
              _id: fakeResourceId,
              name: 'Turing Science Hall',
              code: 'TUR-101',
              location: { building: 'Turing Science Center', floor: 'Floor 1', roomNumber: '101' },
              capacity: 100,
              status: ResourceStatus.MAINTENANCE,
              isActive: true,
            },
          ],
        }),
      }),
    }));

    mock.method(AvailabilityRule, 'find', () => ({ lean: async () => [] }));
    mock.method(Blackout, 'find', () => ({ lean: async () => [] }));
    mock.method(TimetableEntry, 'find', () => ({ lean: async () => [] }));
    mock.method(Reservation, 'find', () => ({
      sort: () => ({ lean: async () => [] }),
      lean: async () => [],
    }));

    const result = await AvailabilityService.checkBuildingAvailability({
      building: 'Turing Science Center',
      startAt: new Date('2026-11-05T09:00:00Z'),
      endAt: new Date('2026-11-05T11:00:00Z'),
    });

    assert.ok(result);
    assert.equal(result.summary.counts.maintenance, 1);
    assert.equal(result.resources.length, 1);
    assert.equal(result.resources[0].availability.visualStatus, 'maintenance');
    assert.equal(result.resources[0].availability.message, 'Resource is currently under maintenance');
    // Ensure the internal deactivation reason is strictly omitted from the facility response
    assert.equal(result.resources[0].availability.deactivationReason, undefined);
    assert.equal(result.resources[0].deactivationReason, undefined);
  });
});
