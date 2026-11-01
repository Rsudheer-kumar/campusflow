/**
 * CampusFlow API - Request Validation Foundation Middleware
 * Provides a clean, reusable validation pattern for future modules
 * supporting body, query, and path parameters.
 */

import { ValidationError } from '../utils/errors.js';

/**
 * Creates an Express middleware that validates req.body, req.query, or req.params.
 * If validation fails, raises a structured ValidationError (HTTP 400).
 */
export function validateRequest(schema) {
  return (req, _res, next) => {
    const issues = [];

    if (schema.params) {
      const result = schema.params(req.params);
      if (!result.success && result.errors) {
        issues.push(...result.errors.map((e) => ({ ...e, field: `params.${e.field}` })));
      } else if (result.data && typeof result.data === 'object') {
        req.params = result.data;
      }
    }

    if (schema.query) {
      const result = schema.query(req.query);
      if (!result.success && result.errors) {
        issues.push(...result.errors.map((e) => ({ ...e, field: `query.${e.field}` })));
      } else if (result.data && typeof result.data === 'object') {
        Object.defineProperty(req, 'query', {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
    }

    if (schema.body) {
      const result = schema.body(req.body);
      if (!result.success && result.errors) {
        issues.push(...result.errors.map((e) => ({ ...e, field: `body.${e.field}` })));
      } else if (result.data) {
        req.body = result.data;
      }
    }

    if (issues.length > 0) {
      return next(new ValidationError('Request validation failed', issues));
    }

    next();
  };
}
