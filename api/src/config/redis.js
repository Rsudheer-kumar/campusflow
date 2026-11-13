/**
 * CampusFlow API - Redis Configuration Foundation
 * Manages Redis client lifecycle, provides connection state helpers,
 * handles reconnect backoff, redacts credentials, and supports graceful shutdown.
 */

import { createClient } from 'redis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let redisClient = null;
let connectingPromise = null;
let lastRedisError = null;

/**
 * Sanitizes Redis URL by redacting password/credentials if present.
 */
export function redactRedisUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')
            .replace(/\/\/:([^@]+)@/, '//:****@');
}

export function getRedisClient() {
  return redisClient;
}

export function getLastRedisError() {
  return lastRedisError;
}

export async function connectRedis(urlOverride) {
  const targetUrl = urlOverride !== undefined ? urlOverride : env.REDIS_URL;

  // If Redis is unconfigured or disabled, skip connection attempt gracefully
  if (!targetUrl) {
    logger.info('Redis URL not configured — running in documented degraded in-memory mode');
    return null;
  }

  // If already connected and ready, return existing client
  if (redisClient && redisClient.isReady) {
    logger.debug('Redis already connected and ready');
    return redisClient;
  }

  // Prevent duplicate concurrent connection attempts by returning in-flight promise
  if (connectingPromise) {
    logger.debug('Redis connection attempt already in progress, awaiting existing promise');
    return connectingPromise;
  }

  connectingPromise = (async () => {
    try {
      if (!redisClient || urlOverride) {
        // If client exists but we are switching target URL, close previous
        if (redisClient && redisClient.isOpen) {
          try {
            await redisClient.destroy();
          } catch {
            // ignore cleanup error
          }
        }

        redisClient = createClient({
          url: targetUrl,
          socket: {
            connectTimeout: 2000,
            reconnectStrategy: (retries) => {
              // Bounded retry to avoid infinite reconnect loops and log spam
              if (env.isTest || retries >= 1) {
                lastRedisError = 'Redis service unreachable';
                return new Error('Redis service unreachable');
              }
              return Math.min(retries * 500, 1000);
            },
          },
        });

        redisClient.on('error', (err) => {
          lastRedisError = err.message;
          // Only log unexpected runtime error if client was active
          if (redisClient?.isReady) {
            logger.error('Redis client runtime error', err.message);
          }
        });

        redisClient.on('connect', () => {
          logger.debug('Redis socket connecting...');
        });

        redisClient.on('ready', () => {
          lastRedisError = null;
          logger.info('Redis client connected and ready');
        });

        redisClient.on('reconnecting', () => {
          logger.debug('Redis client reconnecting...');
        });

        redisClient.on('end', () => {
          logger.debug('Redis client connection closed');
        });
      }

      logger.debug('Connecting to Redis...', { url: redactRedisUrl(targetUrl) });
      await redisClient.connect();
      lastRedisError = null;
      return redisClient;
    } catch (error) {
      lastRedisError = error instanceof Error ? error.message : String(error);
      if (redisClient) {
        try {
          redisClient.destroy();
        } catch {
          // ignore cleanup error
        }
      }
      throw error;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
}

export async function disconnectRedis() {
  connectingPromise = null;
  const clientToClose = redisClient;
  redisClient = null;
  lastRedisError = null;

  try {
    if (clientToClose && clientToClose.isReady) {
      await clientToClose.quit();
      logger.debug('Redis client disconnected cleanly');
    } else if (clientToClose) {
      clientToClose.destroy();
    }
  } catch {
    if (clientToClose) {
      try {
        clientToClose.destroy();
      } catch {
        // ignore cleanup error
      }
    }
  } finally {
    if (clientToClose) {
      try {
        clientToClose.removeAllListeners();
      } catch {
        // ignore listener cleanup error
      }
    }
  }
}

export function isRedisConnected() {
  return redisClient !== null && redisClient.isReady;
}

export function getRedisState() {
  if (!redisClient) {
    return lastRedisError ? 'error' : 'disconnected';
  }
  if (redisClient.isReady) {
    return 'connected';
  }
  if (redisClient.isOpen) {
    return 'connecting';
  }
  if (lastRedisError) {
    return 'error';
  }
  return 'disconnected';
}
