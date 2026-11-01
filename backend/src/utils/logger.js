/**
 * CampusFlow API - Structured Logger Utility
 * Lightweight, structured console logger that avoids terminal flooding
 * and prevents accidental leakage of sensitive tokens/passwords.
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel =
  process.env.NODE_ENV === 'test'
    ? 'error'
    : process.env.LOG_LEVEL || 'info';

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaString = meta !== undefined ? ` ${typeof meta === 'object' ? JSON.stringify(sanitizeMeta(meta)) : meta}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
}

/**
 * Strips sensitive keys to prevent logging secrets, passwords, or tokens.
 */
function sanitizeMeta(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeMeta);
  }

  const SENSITIVE_KEYS = /password|token|secret|authorization|cookie|key/i;
  const sanitized = {};

  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeMeta(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

export const logger = {
  debug(message, meta) {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.debug) {
      console.debug(formatMessage('debug', message, meta));
    }
  },

  info(message, meta) {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.info) {
      console.info(formatMessage('info', message, meta));
    }
  },

  warn(message, meta) {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  error(message, meta) {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.error) {
      console.error(formatMessage('error', message, meta));
    }
  },
};
