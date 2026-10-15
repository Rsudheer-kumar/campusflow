/**
 * CampusFlow API - 404 Not Found Middleware
 * Intercepts unhandled routes and returns a structured JSON error.
 */

import { sendError } from '../utils/response.js';

export function notFoundHandler(req, res) {
  sendError(
    res,
    'ROUTE_NOT_FOUND',
    `Route not found: ${req.method} ${req.originalUrl}`,
    404
  );
}
