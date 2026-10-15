/**
 * CampusFlow API - Authentication Controller
 * Handles HTTP endpoints for login, refresh, and logout operations
 */

import { AuthenticationService } from '../services/auth.service.js';
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
