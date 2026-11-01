/**
 * CampusFlow API - Authentication Controller
 * Handles HTTP endpoints for login, refresh, and logout operations
 */

import { AuthenticationService } from '../services/auth.service.js';
import { User } from '../models/user.model.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { validateLoginRequest, validateRefreshRequest } from '../validators/index.js';
import { env } from '../config/env.js';

const REFRESH_COOKIE_NAME = 'cf_refresh';
const REFRESH_COOKIE_PATH = '/api/auth';
const REFRESH_COOKIE_MAX_AGE = 604800000; // 7 days in milliseconds

/**
 * POST /api/auth/login
 * Authenticates user by email and password
 * Returns access token and sets refresh token cookie
 */
export const login = async (req, res, next) => {
  try {
    // Validate request body
    const validation = validateLoginRequest(req.body);
    if (!validation.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid request', 400, validation.errors || []);
      return;
    }

    if (!validation.data) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid request', 400);
      return;
    }

    const { email, password } = validation.data;

    // Authenticate user
    const { accessToken, refreshToken, user } = await AuthenticationService.login(email, password);

    // Set refresh token cookie
    // httpOnly: true prevents JavaScript access
    // secure: true in production requires HTTPS
    // sameSite: 'lax' prevents CSRF while allowing top-level navigation
    // path: /api/auth ensures cookie is only sent to auth endpoints
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });

    // Return access token and safe user data (no refresh token in JSON)
    sendSuccess(res, {
      accessToken,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/refresh
 * Issues a new access token using the refresh token cookie
 * Also rotates the refresh token (new cookie with new jti)
 */
export const refresh = async (req, res, next) => {
  try {
    // Extract refresh token from cookie
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    // Validate refresh token presence and format
    const validation = validateRefreshRequest(refreshToken);
    if (!validation.success) {
      const errorMessage = validation.errors?.[0]?.message || 'Unauthorized';
      sendError(res, 'UNAUTHORIZED', errorMessage, 401);
      return;
    }

    if (!validation.data) {
      sendError(res, 'UNAUTHORIZED', 'Unauthorized', 401);
      return;
    }

    // Use the validated token to refresh
    const { accessToken, refreshToken: newRefreshToken, user } = await AuthenticationService.refresh(
      validation.data.token
    );

    // Replace refresh token cookie with new one
    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });

    // Return new access token and safe user data
    sendSuccess(res, {
      accessToken,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Logs out by invalidating all refresh tokens (incrementing tokenVersion)
 * and clearing the refresh token cookie
 */
export const logout = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      sendError(res, 'UNAUTHORIZED', 'Unauthorized', 401);
      return;
    }

    // Invalidate all refresh tokens for this user
    await AuthenticationService.logout(userId);

    // Clear refresh token cookie
    res.clearCookie(REFRESH_COOKIE_NAME, {
      path: REFRESH_COOKIE_PATH,
    });

    sendSuccess(res, { message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/profile
 * Retrieves authenticated user profile, roles, and preferences
 */
export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      sendError(res, 'UNAUTHORIZED', 'Unauthorized', 401);
      return;
    }

    const user = await User.findById(userId).select('-passwordHash').lean();
    if (!user) {
      sendError(res, 'NOT_FOUND', 'User not found', 404);
      return;
    }

    sendSuccess(res, {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      roles: user.roles,
      department: user.department || '',
      identifier: user.identifier || '',
      isActive: user.isActive,
      preferences: user.preferences || {
        defaultView: 'week',
        notifications: true,
        timezone: 'UTC',
      },
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/auth/profile
 * Updates user profile information and UI preferences
 */
export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      sendError(res, 'UNAUTHORIZED', 'Unauthorized', 401);
      return;
    }

    const { name, department, preferences } = req.body || {};
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
        sendError(res, 'VALIDATION_ERROR', 'Name must be between 2 and 100 characters', 400);
        return;
      }
      updates.name = name.trim();
    }

    if (department !== undefined) {
      if (typeof department !== 'string' || department.length > 100) {
        sendError(res, 'VALIDATION_ERROR', 'Department cannot exceed 100 characters', 400);
        return;
      }
      updates.department = department.trim();
    }

    if (preferences !== undefined) {
      if (typeof preferences !== 'object' || preferences === null) {
        sendError(res, 'VALIDATION_ERROR', 'Preferences must be an object', 400);
        return;
      }
      const prefUpdates = {};
      if (preferences.defaultView !== undefined) {
        if (!['day', 'week', 'month'].includes(preferences.defaultView)) {
          sendError(res, 'VALIDATION_ERROR', 'Invalid defaultView. Allowed: day, week, month', 400);
          return;
        }
        prefUpdates['preferences.defaultView'] = preferences.defaultView;
      }
      if (preferences.notifications !== undefined) {
        prefUpdates['preferences.notifications'] = Boolean(preferences.notifications);
      }
      if (preferences.timezone !== undefined) {
        prefUpdates['preferences.timezone'] = String(preferences.timezone).trim();
      }
      Object.assign(updates, prefUpdates);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-passwordHash').lean();

    if (!updatedUser) {
      sendError(res, 'NOT_FOUND', 'User not found', 404);
      return;
    }

    sendSuccess(res, {
      id: updatedUser._id.toString(),
      name: updatedUser.name,
      email: updatedUser.email,
      roles: updatedUser.roles,
      department: updatedUser.department || '',
      identifier: updatedUser.identifier || '',
      isActive: updatedUser.isActive,
      preferences: updatedUser.preferences || {
        defaultView: 'week',
        notifications: true,
        timezone: 'UTC',
      },
      createdAt: updatedUser.createdAt,
      lastLoginAt: updatedUser.lastLoginAt,
    });
  } catch (error) {
    next(error);
  }
};
