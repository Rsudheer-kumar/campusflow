/**
 * CampusFlow API - Approval Policy Administration & RBAC Unit Tests
 *
 * Validates approval policy creation, multi-tier chain invariants,
 * departmental scoping, and administrative authorization rules.
 *
 * TEST ISOLATION:
 * Operates purely in-memory using Node.js native test mocks without
 * requiring or connecting to any live MongoDB or Redis instance.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { requireRoles } from '../src/middleware/auth.js';
import { UserRole } from '../src/models/user.model.js';
import {
  ApprovalPolicy,
  ApprovalScopeType,
  ApproverRole,
} from '../src/models/approvalPolicy.model.js';
import { ApprovalPolicyService } from '../src/services/approvalPolicy.service.js';
import {
  validateCreateApprovalPolicyBody,
  validateUpdateApprovalPolicyBody,
} from '../src/validators/approvalPolicy.validator.js';
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../src/utils/errors.js';

describe('Approval Policy Administration & RBAC (Unit Isolation)', () => {
  const fakeResourceId = new mongoose.Types.ObjectId().toString();
  const fakeTypeId = new mongoose.Types.ObjectId().toString();
  const fakePolicyId = new mongoose.Types.ObjectId().toString();

  describe('RBAC Middleware Enforcement', () => {
    it('should reject unauthorized STUDENT from creating approval policies with 403', () => {
      const middleware = requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER);
      const req = {
        user: { id: 'stu-1', roles: [UserRole.STUDENT] },
      };
      let nextError = null;

      middleware(req, {}, (err) => {
        nextError = err;
      });

      assert.ok(nextError instanceof ForbiddenError);
    });

    it('should allow FACILITY_MANAGER to manage approval policies', () => {
      const middleware = requireRoles(UserRole.ADMIN, UserRole.FACILITY_MANAGER);
      const req = {
        user: { id: 'fm-1', roles: [UserRole.FACILITY_MANAGER] },
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

    it('should restrict DELETE archiving of approval policies to ADMIN only', () => {
      const middleware = requireRoles(UserRole.ADMIN);
      const req = {
        user: { id: 'fm-1', roles: [UserRole.FACILITY_MANAGER] }, // FM cannot archive
      };
      let nextError = null;

      middleware(req, {}, (err) => {
        nextError = err;
      });

      assert.ok(nextError instanceof ForbiddenError);
    });

    it('should allow DEPARTMENT_HEAD to inspect approval policies', () => {
      const middleware = requireRoles(
        UserRole.ADMIN,
        UserRole.FACILITY_MANAGER,
        UserRole.DEPARTMENT_HEAD
      );
      const req = {
        user: { id: 'dh-1', roles: [UserRole.DEPARTMENT_HEAD] },
      };
      let nextCalled = false;

      middleware(req, {}, (err) => {
        nextCalled = true;
        assert.strictEqual(err, undefined);
      });

      assert.strictEqual(nextCalled, true);
    });
  });

  describe('Payload & Chain Validation Logic', () => {
    it('should reject policy when scope is RESOURCE but resource ID is missing', () => {
      const result = validateCreateApprovalPolicyBody({
        name: 'Invalid Resource Policy',
        scopeType: 'RESOURCE',
        requiresApproval: true,
        approvalChain: [{ stepOrder: 1, approverRole: 'FACILITY_MANAGER' }],
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some((e) => e.field === 'resource'));
    });

    it('should reject policy when scope is RESOURCE_TYPE but resourceType ID is missing', () => {
      const result = validateCreateApprovalPolicyBody({
        name: 'Invalid Type Policy',
        scopeType: 'RESOURCE_TYPE',
        requiresApproval: true,
        approvalChain: [{ stepOrder: 1, approverRole: 'ADMIN' }],
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some((e) => e.field === 'resourceType'));
    });

    it('should reject duplicate approver roles in approval chain', () => {
      const result = validateCreateApprovalPolicyBody({
        name: 'Duplicate Roles Policy',
        scopeType: 'RESOURCE',
        resource: fakeResourceId,
        requiresApproval: true,
        approvalChain: [
          { stepOrder: 1, approverRole: 'DEPARTMENT_HEAD' },
          { stepOrder: 2, approverRole: 'DEPARTMENT_HEAD' }, // duplicate
        ],
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some((e) => e.field.startsWith('approvalChain')));
    });

    it('should reject non-consecutive step order in approval chain', () => {
      const result = validateCreateApprovalPolicyBody({
        name: 'Non-consecutive Policy',
        scopeType: 'RESOURCE',
        resource: fakeResourceId,
        requiresApproval: true,
        approvalChain: [
          { stepOrder: 1, approverRole: 'DEPARTMENT_HEAD' },
          { stepOrder: 3, approverRole: 'ADMIN' }, // expected 2
        ],
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some((e) => e.field.startsWith('approvalChain')));
    });

    it('should reject approvalChain steps when requiresApproval is false', () => {
      const result = validateCreateApprovalPolicyBody({
        name: 'Auto-Approved With Chain',
        scopeType: 'RESOURCE',
        resource: fakeResourceId,
        requiresApproval: false,
        approvalChain: [{ stepOrder: 1, approverRole: 'ADMIN' }],
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.errors.some((e) => e.field === 'approvalChain'));
    });

    it('should accept valid multi-tier approval policy payload', () => {
      const result = validateCreateApprovalPolicyBody({
        name: 'Standard Departmental Multi-Tier',
        description: 'Two-tier verification for auditoriums',
        scopeType: 'RESOURCE',
        resource: fakeResourceId,
        requesterRole: 'STUDENT',
        requiresApproval: true,
        approvalChain: [
          { stepOrder: 1, approverRole: 'DEPARTMENT_HEAD', timeoutHours: 24 },
          { stepOrder: 2, approverRole: 'FACILITY_MANAGER', timeoutHours: 48 },
        ],
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.approvalChain.length, 2);
      assert.strictEqual(result.data.approvalChain[0].approverRole, 'DEPARTMENT_HEAD');
      assert.strictEqual(result.data.approvalChain[1].approverRole, 'FACILITY_MANAGER');
    });
  });

  describe('Service Archiving & Conflict Rules', () => {
    it('should safely soft-archive policy without hard deletion', async () => {
      const fakeAdminId = new mongoose.Types.ObjectId().toString();
      let savedArchived = null;
      let savedArchivedBy = null;

      const mockFindById = mock.method(ApprovalPolicy, 'findById', (id) => {
        if (id === fakePolicyId) {
          return {
            _id: fakePolicyId,
            name: 'Policy to Archive',
            isArchived: false,
            isActive: true,
            save: async function () {
              savedArchived = this.isArchived;
              savedArchivedBy = this.archivedBy;
            },
          };
        }
        return null;
      });

      const archived = await ApprovalPolicyService.archivePolicy(fakePolicyId, fakeAdminId);

      mockFindById.mock.restore();

      assert.strictEqual(savedArchived, true);
      assert.ok(savedArchivedBy);
      assert.strictEqual(archived.isArchived, true);
    });

    it('should throw BadRequestError when attempting to update an archived policy', async () => {
      const mockFindById = mock.method(ApprovalPolicy, 'findById', () => ({
        _id: fakePolicyId,
        isArchived: true,
      }));

      await assert.rejects(
        async () => {
          await ApprovalPolicyService.updatePolicy(fakePolicyId, {
            name: 'New Name',
          });
        },
        (err) => {
          assert.match(err.message, /Cannot update an archived policy/i);
          return true;
        }
      );

      mockFindById.mock.restore();
    });
  });
});
