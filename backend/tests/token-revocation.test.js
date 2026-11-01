/**
 * CampusFlow API - Token Revocation & Auth Middleware Unit Tests
 *
 * Validates immediate access token revocation, tokenVersion comparison,
 * inactive user rejection, and trusted req.user context attachment.
 *
 * TEST ISOLATION:
 * Operates purely in-memory using Node.js native test mocks without
 * requiring or connecting to any live MongoDB instance.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { authenticate } from '../src/middleware/auth.js';
import { User, UserRole } from '../src/models/user.model.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { UnauthorizedError } from '../src/utils/errors.js';

describe('Token Revocation & Auth Middleware (Unit Isolation)', () => {
  const fakeUserId = new mongoose.Types.ObjectId().toString();

  it('should reject request when Authorization header is missing', async () => {
    const req = { headers: {} };
    const res = {};
    let nextError = null;

    await authenticate(req, res, (err) => {
      nextError = err;
    });

    assert.ok(nextError instanceof UnauthorizedError);
    assert.match(nextError.message, /Authorization header with Bearer token required/i);
  });

  it('should reject request with malformed Authorization header scheme', async () => {
    const req = { headers: { authorization: 'Basic some-token' } };
    const res = {};
    let nextError = null;

    await authenticate(req, res, (err) => {
      nextError = err;
    });

    assert.ok(nextError instanceof UnauthorizedError);
    assert.match(nextError.message, /Authorization header with Bearer token required/i);
  });

  it('should authenticate valid token when tokenVersion matches database', async () => {
    const validToken = signAccessToken({
      sub: fakeUserId,
      email: 'student@campusflow.edu',
      roles: [UserRole.STUDENT],
      department: 'Computer Science',
      isActive: true,
      tokenVersion: 2,
    });

    const mockFindById = mock.method(User, 'findById', () => ({
      select: () => ({
        lean: async () => ({
          _id: new mongoose.Types.ObjectId(fakeUserId),
          email: 'student@campusflow.edu',
          roles: [UserRole.STUDENT],
          department: 'Computer Science',
          isActive: true,
          tokenVersion: 2,
        }),
      }),
    }));

    const req = { headers: { authorization: `Bearer ${validToken}` } };
    const res = {};
    let nextCalled = false;
    let nextError = null;

    await authenticate(req, res, (err) => {
      nextCalled = true;
      nextError = err;
    });

    mockFindById.mock.restore();

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(nextError, undefined);
    assert.ok(req.user);
    assert.strictEqual(req.user.id, fakeUserId);
    assert.strictEqual(req.user.tokenVersion, 2);
    assert.strictEqual(req.user.email, 'student@campusflow.edu');
  });

  it('should reject access token immediately when tokenVersion has been incremented (revoked)', async () => {
    // Issued token has tokenVersion: 0 (prior to logout or password reset)
    const oldToken = signAccessToken({
      sub: fakeUserId,
      email: 'student@campusflow.edu',
      roles: [UserRole.STUDENT],
      department: 'Computer Science',
      isActive: true,
      tokenVersion: 0,
    });

    // Database user has tokenVersion: 1 (after User.findByIdAndUpdate(..., $inc: { tokenVersion: 1 }))
    const mockFindById = mock.method(User, 'findById', () => ({
      select: () => ({
        lean: async () => ({
          _id: new mongoose.Types.ObjectId(fakeUserId),
          email: 'student@campusflow.edu',
          roles: [UserRole.STUDENT],
          department: 'Computer Science',
          isActive: true,
          tokenVersion: 1,
        }),
      }),
    }));

    const req = { headers: { authorization: `Bearer ${oldToken}` } };
    const res = {};
    let nextError = null;

    await authenticate(req, res, (err) => {
      nextError = err;
    });

    mockFindById.mock.restore();

    assert.ok(nextError instanceof UnauthorizedError);
    assert.strictEqual(nextError.message, 'Token has been revoked');
    assert.strictEqual(req.user, undefined);
  });

  it('should handle legacy user documents without tokenVersion field consistently', async () => {
    // Token issued with default version 0
    const token = signAccessToken({
      sub: fakeUserId,
      email: 'legacy@campusflow.edu',
      roles: [UserRole.FACULTY],
      department: 'Physics',
      isActive: true,
      tokenVersion: 0,
    });

    // Legacy DB document missing tokenVersion property (undefined)
    const mockFindById = mock.method(User, 'findById', () => ({
      select: () => ({
        lean: async () => ({
          _id: new mongoose.Types.ObjectId(fakeUserId),
          email: 'legacy@campusflow.edu',
          roles: [UserRole.FACULTY],
          department: 'Physics',
          isActive: true,
          // tokenVersion is intentionally undefined
        }),
      }),
    }));

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    let nextCalled = false;
    let nextError = null;

    await authenticate(req, res, (err) => {
      nextCalled = true;
      nextError = err;
    });

    mockFindById.mock.restore();

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(nextError, undefined);
    assert.ok(req.user);
    assert.strictEqual(req.user.tokenVersion, 0);
  });

  it('should reject request when account is marked inactive in database', async () => {
    const token = signAccessToken({
      sub: fakeUserId,
      email: 'inactive@campusflow.edu',
      roles: [UserRole.STUDENT],
      isActive: true,
      tokenVersion: 0,
    });

    const mockFindById = mock.method(User, 'findById', () => ({
      select: () => ({
        lean: async () => ({
          _id: new mongoose.Types.ObjectId(fakeUserId),
          email: 'inactive@campusflow.edu',
          roles: [UserRole.STUDENT],
          isActive: false, // User was deactivated
          tokenVersion: 0,
        }),
      }),
    }));

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    let nextError = null;

    await authenticate(req, res, (err) => {
      nextError = err;
    });

    mockFindById.mock.restore();

    assert.ok(nextError instanceof UnauthorizedError);
    assert.match(nextError.message, /Account is inactive/i);
  });

  it('should reject request when user is not found in database', async () => {
    const token = signAccessToken({
      sub: fakeUserId,
      email: 'deleted@campusflow.edu',
      roles: [UserRole.STUDENT],
      isActive: true,
      tokenVersion: 0,
    });

    const mockFindById = mock.method(User, 'findById', () => ({
      select: () => ({
        lean: async () => null, // User deleted
      }),
    }));

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    let nextError = null;

    await authenticate(req, res, (err) => {
      nextError = err;
    });

    mockFindById.mock.restore();

    assert.ok(nextError instanceof UnauthorizedError);
    assert.match(nextError.message, /User not found/i);
  });
});
