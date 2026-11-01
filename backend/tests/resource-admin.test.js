/**
 * CampusFlow API - Resource Administration & Authorization Unit Tests
 *
 * Validates resource creation, updates, safe archiving, and role-based
 * access controls (ADMIN / FACILITY_MANAGER vs unauthorized roles).
 *
 * TEST ISOLATION:
 * Operates purely in-memory using Node.js native test mocks without
 * requiring or connecting to any live MongoDB or Redis instance.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ResourceController } from '../src/controllers/resource.controller.js';
import { ResourceService } from '../src/services/resource.service.js';
import { Resource, ResourceStatus } from '../src/models/resource.model.js';
import { ResourceType } from '../src/models/resourceType.model.js';
import {
  validateCreateResourceBody,
  validateUpdateResourceBody,
  validateToggleResourceStatusBody,
} from '../src/validators/resource.validator.js';
import { requireRoles } from '../src/middleware/auth.js';
import { UserRole } from '../src/models/user.model.js';
import { ForbiddenError, NotFoundError, ConflictError } from '../src/utils/errors.js';

describe('Resource Administration & RBAC (Unit Isolation)', () => {
  const fakeTypeId = new mongoose.Types.ObjectId().toString();
  const fakeResourceId = new mongoose.Types.ObjectId().toString();

  describe('RBAC Middleware Enforcement', () => {
    it('should reject unauthorized STUDENT role from resource administration with 403', () => {
      const middleware = requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER);
      const req = {
        user: {
          id: 'user-123',
          roles: [UserRole.STUDENT],
        },
      };
      let nextError = null;

      middleware(req, {}, (err) => {
        nextError = err;
      });

      assert.ok(nextError instanceof ForbiddenError);
      assert.match(nextError.message, /Forbidden/i);
    });

    it('should allow ADMIN role to pass through resource admin middleware', () => {
      const middleware = requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER);
      const req = {
        user: {
          id: 'admin-123',
          roles: [UserRole.ADMIN],
        },
      };
      let nextCalled = false;
      let nextError = null;

      middleware(req, {}, (err) => {
        nextCalled = true;
        nextError = err;
      });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(nextError, undefined);
    });

    it('should allow FACILITY_MANAGER role to pass through resource admin middleware', () => {
      const middleware = requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER);
      const req = {
        user: {
          id: 'fm-123',
          roles: [UserRole.FACILITY_MANAGER],
        },
      };
      let nextCalled = false;
      let nextError = null;

      middleware(req, {}, (err) => {
        nextCalled = true;
        nextError = err;
      });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(nextError, undefined);
    });
  });

  describe('Validation Logic', () => {
    it('should reject resource creation when required fields are missing', () => {
      const result = validateCreateResourceBody({});
      assert.strictEqual(result.success, false);
      const fields = result.errors.map((e) => e.field);
      assert.ok(fields.includes('name'));
      assert.ok(fields.includes('code'));
      assert.ok(fields.includes('resourceType'));
      assert.ok(fields.includes('capacity'));
      assert.ok(fields.includes('location'));
    });

    it('should reject invalid resource code with special symbols', () => {
      const result = validateCreateResourceBody({
        name: 'Lecture Hall A',
        code: 'LH#101!',
        resourceType: fakeTypeId,
        capacity: 100,
        location: { building: 'Science Center' },
      });
      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some((e) => e.field === 'code'));
    });

    it('should reject non-positive or non-integer capacity', () => {
      const result = validateCreateResourceBody({
        name: 'Seminar Room',
        code: 'SEM201',
        resourceType: fakeTypeId,
        capacity: 0,
        location: { building: 'Liberal Arts' },
      });
      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some((e) => e.field === 'capacity'));
    });

    it('should accept valid resource payload and normalize uppercase code', () => {
      const result = validateCreateResourceBody({
        name: 'Turing Hall',
        code: 'lh-101',
        resourceType: fakeTypeId,
        capacity: 150,
        location: {
          building: 'Science Complex',
          floor: '1',
          roomNumber: '101',
        },
        status: ResourceStatus.ACTIVE,
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.code, 'LH-101');
      assert.strictEqual(result.data.capacity, 150);
      assert.strictEqual(result.data.location.building, 'Science Complex');
    });

    it('should validate status toggle payload', () => {
      const invalid = validateToggleResourceStatusBody({});
      assert.strictEqual(invalid.success, false);

      const valid = validateToggleResourceStatusBody({ status: 'MAINTENANCE' });
      assert.strictEqual(valid.success, true);
      assert.strictEqual(valid.data.status, 'MAINTENANCE');
    });
  });

  describe('Service Business Rules & Safe Archiving', () => {
    it('should reject resource creation when referenced ResourceType does not exist', async () => {
      const mockTypeFind = mock.method(ResourceType, 'findById', () => ({
        lean: async () => null,
      }));

      await assert.rejects(
        async () => {
          await ResourceService.createResource({
            name: 'Physics Lab',
            code: 'PHY101',
            resourceType: fakeTypeId,
            capacity: 30,
            location: { building: 'Science' },
          });
        },
        (err) => {
          assert.ok(err instanceof NotFoundError);
          assert.match(err.message, /ResourceType with ID/i);
          return true;
        }
      );

      mockTypeFind.mock.restore();
    });

    it('should reject duplicate code with ConflictError', async () => {
      const mockTypeFind = mock.method(ResourceType, 'findById', () => ({
        lean: async () => ({ _id: fakeTypeId, name: 'Lab' }),
      }));

      const mockResFindOne = mock.method(Resource, 'findOne', () => ({
        lean: async () => ({ _id: 'existing-id', code: 'PHY101' }),
      }));

      await assert.rejects(
        async () => {
          await ResourceService.createResource({
            name: 'Physics Lab 2',
            code: 'PHY101',
            resourceType: fakeTypeId,
            capacity: 30,
            location: { building: 'Science' },
          });
        },
        (err) => {
          assert.ok(err instanceof ConflictError);
          assert.match(err.message, /already exists/i);
          return true;
        }
      );

      mockTypeFind.mock.restore();
      mockResFindOne.mock.restore();
    });

    it('should safely archive resource without deleting document or references', async () => {
      let savedStatus = null;
      let savedActive = null;

      const mockFindById = mock.method(Resource, 'findById', (id) => {
        if (id === fakeResourceId) {
          return {
            _id: fakeResourceId,
            name: 'Old Lab',
            status: ResourceStatus.ACTIVE,
            isActive: true,
            save: async function () {
              savedStatus = this.status;
              savedActive = this.isActive;
            },
            populate: () => ({
              lean: async () => ({
                _id: fakeResourceId,
                name: 'Old Lab',
                status: savedStatus,
                isActive: savedActive,
              }),
            }),
          };
        }
        return {
          populate: () => ({
            lean: async () => ({
              _id: fakeResourceId,
              name: 'Old Lab',
              status: savedStatus,
              isActive: savedActive,
            }),
          }),
        };
      });

      const archived = await ResourceService.archiveResource(fakeResourceId);

      mockFindById.mock.restore();

      assert.strictEqual(savedStatus, ResourceStatus.RETIRED);
      assert.strictEqual(savedActive, false);
      assert.strictEqual(archived.status, ResourceStatus.RETIRED);
      assert.strictEqual(archived.isActive, false);
    });
  });
});
