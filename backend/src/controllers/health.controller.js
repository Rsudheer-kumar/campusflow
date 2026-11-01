/**
 * CampusFlow API - Health Controller
 * Coordinates health checks between routing and services.
 */

import { checkHealth } from '../services/health.service.js';
import { sendSuccess } from '../utils/response.js';

export function getHealth(_req, res) {
  const healthData = checkHealth();
  sendSuccess(res, healthData, 200);
}
