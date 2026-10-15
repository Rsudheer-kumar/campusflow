/**
 * CampusFlow API - Validation Foundation
 * Reusable schema validators and helpers for future modules.
 */

import { verifyRefreshToken } from '../utils/jwt.js';

/**
 * Validates a MongoDB 24-character hexadecimal ObjectId.
 */
export function validateMongoId(idName = 'id') {
  const hex24Regex = /^[0-9a-fA-F]{24}$/;
  return (data) => {
    const record = data;
    const value = record?.[idName];

    if (!value || typeof value !== 'string' || !hex24Regex.test(value)) {
      return {
        success: false,
        errors: [{ field: idName, message: `Invalid identifier format for "${idName}". Expected 24-char hex string.` }],
      };
    }

    return {
      success: true,
      data: { [idName]: value },
    };
  };
}

/**
 * Validates common pagination query parameters (page, limit).
 */
export function validatePaginationQuery(data) {
  const record = (data || {});
  const errors = [];

  let page = 1;
  let limit = 20;

  if (record.page !== undefined) {
    const parsedPage = Number(record.page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      errors.push({ field: 'page', message: 'Page must be an integer greater than or equal to 1' });
    } else {
      page = parsedPage;
    }
  }

  if (record.limit !== undefined) {
    const parsedLimit = Number(record.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      errors.push({ field: 'limit', message: 'Limit must be an integer between 1 and 100' });
    } else {
      limit = parsedLimit;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { page, limit },
  };
}

/**
 * Validates login request body (email, password)
 */
export function validateLoginRequest(data) {
  const record = (data || {});
  const errors = [];

  const email = record.email;
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    errors.push({ field: 'email', message: 'Email is required and must be a non-empty string' });
  }

  const password = record.password;
  if (!password || typeof password !== 'string' || password.length === 0) {
    errors.push({ field: 'password', message: 'Password is required and must be a non-empty string' });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      email: email.toLowerCase().trim(),
      password: password,
    },
  };
}

/**
 * Validates refresh token from request
 * Extracts and verifies the refresh token structure
 */
export function validateRefreshRequest(token) {
  if (!token || typeof token !== 'string') {
    return {
      success: false,
      errors: [{ field: 'cookie', message: 'Refresh token cookie (cf_refresh) is required' }],
    };
  }

  // Verify token format and signature without using the result yet
  try {
    verifyRefreshToken(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid refresh token';
    return {
      success: false,
      errors: [{ field: 'cookie', message }],
    };
  }

  return {
    success: true,
    data: { token },
  };
}

export * from './approvalPolicy.validator.js';
export * from './booking.validator.js';
export * from './resource.validator.js';
export * from './timetable.validator.js';
