/**
 * CampusFlow API - Request Logging Middleware
 * Lightweight HTTP request logger that records method, path, status, and duration.
 * Sanitizes URLs to prevent logging query parameters with sensitive tokens.
 */

import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function requestLogger(req, res, next) {
  if (env.isTest) {
    return next();
  }

  const startTime = Date.now();
  const { method, originalUrl } = req;
  const pathOnly = originalUrl.split('?')[0] || originalUrl;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    const message = `${method} ${pathOnly} -> ${statusCode} (${duration}ms)`;

    if (statusCode >= 500) {
      logger.error(message);
    } else if (statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });

  next();
}
