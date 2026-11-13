/**
 * CampusFlow API - Ingress Proxy Authentication Middleware
 * Validates the shared secret between the Next.js frontend proxy and Express API.
 * Uses timing-safe comparison to prevent timing attacks.
 */

import crypto from 'crypto';
import { env } from '../config/env.js';
import { ForbiddenError } from '../utils/errors.js';

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Middleware: validateProxySecret
 * In production when PROXY_SECRET is configured, verifies that requests to protected API endpoints
 * originated from the authorized CampusFlow frontend proxy.
 *
 * Exemptions:
 * - Local development and test environments (always permitted).
 * - /api/health and /api/health/* (Render infrastructure probes & external monitors).
 * - Root path / (API info endpoint).
 */
export function validateProxySecret(req, _res, next) {
  // Always permit in development, test, or when PROXY_SECRET is unconfigured
  if (!env.isProduction || !env.PROXY_SECRET) {
    return next();
  }

  // Always permit health checks for cloud infrastructure probes
  const path = req.path || '';
  if (
    path === '/health' ||
    path.startsWith('/health/') ||
    req.baseUrl === '/health'
  ) {
    return next();
  }

  const incomingSecret = req.headers['x-campusflow-proxy-secret'];

  const isValid =
    safeCompare(incomingSecret, env.PROXY_SECRET) ||
    (Boolean(env.PROXY_SECRET_FALLBACK) && safeCompare(incomingSecret, env.PROXY_SECRET_FALLBACK));

  if (!isValid) {
    return next(
      new ForbiddenError('Direct API access is restricted. Requests must originate from the authorized CampusFlow proxy.')
    );
  }

  next();
}

