/**
 * CampusFlow API - Authentication and RBAC Middleware
 * Provides JWT authentication verification and role-based access control (RBAC).
 */

import { verifyAccessToken } from '../utils/jwt.js';
import { User } from '../models/user.model.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

/**
 * @typedef {Object} AuthenticatedUser
 * @property {string} id - The MongoDB user ID string.
 * @property {string} email - The user's institutional email address.
 * @property {string[]} roles - Array of assigned roles (e.g. ['STUDENT', 'FACULTY', 'CUSTODIAN', 'ADMIN']).
 * @property {string} [department] - Academic department or organizational unit.
 * @property {boolean} isActive - Whether the user account is active.
 * @property {number} tokenVersion - Token revocation tracking version.
 */

/**
 * Middleware: authenticate
 * Extracts, cryptographically verifies, and validates the access JWT from the Authorization header.
 * Performs database existence and active status verification, then attaches trusted user context to `req.user`.
 *
 * @param {import('express').Request & { user?: AuthenticatedUser }} req - Express request object.
 * @param {import('express').Response} _res - Express response object (unused).
 * @param {import('express').NextFunction} next - Express next function.
 * @returns {Promise<void>}
 * @throws {UnauthorizedError} When Authorization header is missing, malformed, expired, or user is inactive.
 */
export const authenticate = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedError('Authorization header with Bearer token required');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authorization header with Bearer token required');
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedError('Authorization header with Bearer token required');
    }

    // Cryptographic verification and claim validation
    const decoded = verifyAccessToken(token);

    // Database lookup for active user verification
    const user = await User.findById(decoded.sub)
      .select('_id email roles department isActive tokenVersion')
      .lean();

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is inactive');
    }

    // Attach trusted user object to req.user (no password hash, no secrets)
    req.user = {
      id: user._id.toString(),
      email: user.email,
      roles: user.roles,
      department: user.department,
      isActive: user.isActive,
      tokenVersion: user.tokenVersion ?? 0,
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      next(error);
    } else if (error instanceof Error) {
      next(new UnauthorizedError(error.message));
    } else {
      next(new UnauthorizedError('Authentication failed'));
    }
  }
};

/**
 * Middleware Factory: requireRoles
 * Enforces Role-Based Access Control (RBAC) using OR logic across required roles.
 * Expects `req.user` to be populated by the preceding `authenticate` middleware.
 *
 * @param {...string} roles - One or more allowed roles (e.g. 'ADMIN', 'CUSTODIAN', 'FACULTY').
 * @returns {import('express').RequestHandler} Express middleware validating user roles.
 */
export const requireRoles = (...roles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Unauthorized'));
    }

    const hasRole = roles.some((role) => req.user?.roles.includes(role));
    if (!hasRole) {
      return next(new ForbiddenError('Forbidden: Insufficient permissions'));
    }

    next();
  };
};
