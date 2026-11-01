/**
 * CampusFlow API - Standardized Response Helpers
 * Ensures consistent JSON response structure across all endpoints.
 *
 * @typedef {Object} ApiResponse
 * @property {true} success - Indicates whether the request succeeded.
 * @property {*} data - The payload returned by the operation.
 *
 * @typedef {Object} ApiErrorDetail
 * @property {string} code - Machine-readable error code (e.g. "BAD_REQUEST", "NOT_FOUND").
 * @property {string} message - Human-readable explanation of the failure.
 * @property {*=} details - Optional contextual metadata or field-level validation errors.
 *
 * @typedef {Object} ApiErrorResponse
 * @property {false} success - Always false for error envelopes.
 * @property {ApiErrorDetail} error - The structured error object.
 */

/**
 * Sends a standardized JSON success response.
 *
 * @param {import('express').Response} res - Express response object.
 * @param {*} data - Payload data to include in the `data` envelope property.
 * @param {number} [statusCode=200] - HTTP status code (defaults to 200 OK).
 * @returns {import('express').Response} The Express response.
 */
export function sendSuccess(res, data, statusCode = 200) {
  const body = {
    success: true,
    data,
  };
  return res.status(statusCode).json(body);
}

/**
 * Sends a standardized JSON error response.
 *
 * @param {import('express').Response} res - Express response object.
 * @param {string} code - Machine-readable error code.
 * @param {string} message - Human-readable error message.
 * @param {number} [statusCode=500] - HTTP status code (defaults to 500 Internal Server Error).
 * @param {*=} details - Optional contextual error details or validation violations.
 * @returns {import('express').Response} The Express response.
 */
export function sendError(
  res,
  code,
  message,
  statusCode = 500,
  details
) {
  const body = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
  return res.status(statusCode).json(body);
}
