/**
 * CampusFlow API - Health Controller
 * Coordinates health checks between routing and services.
 */

import { checkHealth } from '../services/health.service.js';
import { getDatabaseState } from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * GET /api/health
 * Retains full diagnostic summary with stable HTTP 200 response
 */
export function getHealth(_req, res) {
  const healthData = checkHealth();
  sendSuccess(res, healthData, 200);
}

/**
 * GET /api/health/live
 * Process liveness probe: returns HTTP 200 when the process responds
 */
export function getLiveness(_req, res) {
  sendSuccess(res, {
    status: 'alive',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  }, 200);
}

/**
 * GET /api/health/ready
 * Readiness probe: returns HTTP 200 only when MongoDB is connected; HTTP 503 otherwise.
 * Redis is optional and does not independently fail readiness.
 */
export function getReadiness(_req, res) {
  const dbState = getDatabaseState();
  const isReady = dbState === 'connected';

  if (!isReady) {
    return sendError(
      res,
      'SERVICE_UNAVAILABLE',
      'Database connection not ready',
      503,
      { database: dbState }
    );
  }

  return sendSuccess(res, {
    status: 'ready',
    database: dbState,
    timestamp: new Date().toISOString(),
  }, 200);
}
