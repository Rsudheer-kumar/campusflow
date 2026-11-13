/**
 * CampusFlow API - Analytics & Settings Profile Unit Tests
 *
 * Validates:
 * 1. GET /api/auth/profile - identity and user preferences retrieval
 * 2. PATCH /api/auth/profile - preference validation and updates
 * 3. GET /api/analytics/overview - aggregation summaries, building loads, status distributions
 * 4. Analytics RBAC - student access rejection vs administrator / department head authorization
 *
 * TEST ISOLATION:
 * Operates purely in-memory using Node.js native test mocks without
 * requiring or connecting to any live MongoDB instance.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { getProfile, updateProfile } from '../src/controllers/auth.controller.js';
import { getAnalyticsOverview } from '../src/controllers/analytics.controller.js';
import { AnalyticsService } from '../src/services/analytics.service.js';
import { User, UserRole } from '../src/models/user.model.js';
import { requireRoles } from '../src/middleware/auth.js';
import { ForbiddenError } from '../src/utils/errors.js';

describe('Analytics & Settings Unit Tests (In-Memory Isolation)', () => {
  const fakeUserId = new mongoose.Types.ObjectId().toString();

  describe('User Settings & Profile Controller', () => {
    it('should retrieve user profile with default preferences when preferences are empty', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(fakeUserId),
        name: 'Jane Student',
        email: 'jane@campusflow.edu',
        roles: [UserRole.STUDENT],
        department: 'Physics',
        identifier: 'STU-101',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      const mockFindById = mock.method(User, 'findById', () => ({
        select: () => ({
          lean: async () => mockUser,
        }),
      }));

      const req = { user: { id: fakeUserId } };
      let capturedResponse = null;
      const res = {
        status: (code) => ({
          json: (data) => {
            capturedResponse = { code, data };
          },
        }),
      };

      try {
        await getProfile(req, res, () => {});
        assert.ok(capturedResponse);
        assert.strictEqual(capturedResponse.code, 200);
        assert.strictEqual(capturedResponse.data.success, true);
        assert.strictEqual(capturedResponse.data.data.name, 'Jane Student');
        assert.strictEqual(capturedResponse.data.data.email, 'jane@campusflow.edu');
        assert.strictEqual(capturedResponse.data.data.preferences.defaultView, 'week');
        assert.strictEqual(capturedResponse.data.data.preferences.notifications, true);
      } finally {
        mockFindById.mock.restore();
      }
    });

    it('should update user profile preferences with validated input', async () => {
      const updatedMockUser = {
        _id: new mongoose.Types.ObjectId(fakeUserId),
        name: 'Jane Doe',
        email: 'jane@campusflow.edu',
        roles: [UserRole.STUDENT],
        department: 'Computer Science',
        isActive: true,
        preferences: {
          defaultView: 'month',
          notifications: false,
          timezone: 'America/New_York',
        },
      };

      const mockFindByIdAndUpdate = mock.method(User, 'findByIdAndUpdate', () => ({
        select: () => ({
          lean: async () => updatedMockUser,
        }),
      }));

      const req = {
        user: { id: fakeUserId },
        body: {
          name: 'Jane Doe',
          department: 'Computer Science',
          preferences: {
            defaultView: 'month',
            notifications: false,
            timezone: 'America/New_York',
          },
        },
      };

      let capturedResponse = null;
      const res = {
        status: (code) => ({
          json: (data) => {
            capturedResponse = { code, data };
          },
        }),
      };

      try {
        await updateProfile(req, res, () => {});
        assert.ok(capturedResponse);
        assert.strictEqual(capturedResponse.code, 200);
        assert.strictEqual(capturedResponse.data.data.name, 'Jane Doe');
        assert.strictEqual(capturedResponse.data.data.preferences.defaultView, 'month');
        assert.strictEqual(capturedResponse.data.data.preferences.notifications, false);
      } finally {
        mockFindByIdAndUpdate.mock.restore();
      }
    });

    it('should reject invalid defaultView preference', async () => {
      const req = {
        user: { id: fakeUserId },
        body: {
          preferences: {
            defaultView: 'invalid_view',
          },
        },
      };

      let capturedError = null;
      const res = {
        status: (code) => ({
          json: (data) => {
            capturedError = { code, data };
          },
        }),
      };

      await updateProfile(req, res, () => {});
      assert.ok(capturedError);
      assert.strictEqual(capturedError.code, 400);
      assert.strictEqual(capturedError.data.error.code, 'VALIDATION_ERROR');
    });
  });

  describe('Analytics Controller & RBAC', () => {
    it('should reject non-administrative / non-head roles via requireRoles middleware', async () => {
      const studentUser = {
        id: fakeUserId,
        roles: [UserRole.STUDENT],
      };

      const middleware = requireRoles(
        UserRole.ADMIN,
        UserRole.FACILITY_MANAGER,
        UserRole.DEPARTMENT_HEAD
      );

      const req = { user: studentUser };
      const res = {};
      let nextError = null;

      await middleware(req, res, (err) => {
        nextError = err;
      });

      assert.ok(nextError instanceof ForbiddenError);
      assert.match(nextError.message, /Forbidden/i);
    });

    it('should allow ADMIN to retrieve analytics overview data', async () => {
      const adminUser = {
        id: fakeUserId,
        roles: [UserRole.ADMIN],
      };

      const mockOverview = {
        summary: {
          totalBookings: 42,
          activeBookings: 12,
          pendingApprovals: 3,
          completedBookings: 25,
          cancelledBookings: 2,
          noShowBookings: 0,
          totalResources: 15,
          activeResources: 14,
          utilizationRate: 80,
        },
        byStatus: [
          { status: 'CONFIRMED', count: 12 },
          { status: 'COMPLETED', count: 25 },
        ],
        byBuilding: [
          { building: 'Turing Science Center', totalBookings: 20, activeBookings: 8 },
        ],
        byType: [{ type: 'Laboratory', count: 15 }],
        recentActivity: [],
      };

      const mockGetOverview = mock.method(AnalyticsService, 'getOverview', async () => mockOverview);

      const req = { user: adminUser };
      let capturedResponse = null;
      const res = {
        status: (code) => ({
          json: (data) => {
            capturedResponse = { code, data };
          },
        }),
      };

      try {
        await getAnalyticsOverview(req, res, () => {});
        assert.ok(capturedResponse);
        assert.strictEqual(capturedResponse.code, 200);
        assert.strictEqual(capturedResponse.data.data.summary.totalBookings, 42);
        assert.strictEqual(capturedResponse.data.data.summary.utilizationRate, 80);
        assert.strictEqual(capturedResponse.data.data.byBuilding[0].building, 'Turing Science Center');
      } finally {
        mockGetOverview.mock.restore();
      }
    });
  });
});
