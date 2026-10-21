/**
 * CampusFlow API - Analytics Controller
 * Handles HTTP requests for analytics aggregations and facility utilization reports.
 */

import { AnalyticsService } from '../services/analytics.service.js';
import { sendSuccess } from '../utils/response.js';

/**
 * GET /api/analytics/overview
 * Returns high-level metrics, distributions, and recent booking activity.
 */
export const getAnalyticsOverview = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getOverview(req.user);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};
