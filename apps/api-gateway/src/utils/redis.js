'use strict';

const Redis  = require('ioredis');
const logger = require('./logger');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableReadyCheck:     true,
  lazyConnect:          false,
  retryStrategy(times) {
    if (times > 10) return null; // stop retrying after 10 attempts
    return Math.min(times * 200, 2000); // exponential backoff up to 2s
  },
});

redis.on('connect',  () => logger.info('Redis connected'));
redis.on('ready',    () => logger.info('Redis ready'));
redis.on('error',    (err) => logger.error('Redis error', { err: err.message }));
redis.on('close',    () => logger.warn('Redis connection closed'));
redis.on('reconnecting', () => logger.info('Redis reconnecting...'));

// Stream names
const ANCHOR_STREAM = 'sacco:anchor:queue';

/**
 * Append a commitment to the anchor queue stream.
 * Uses XADD with auto-generated ID (*).
 *
 * @param {object} fields - key/value pairs (all values converted to strings)
 * @returns {string} stream entry ID
 */
async function enqueueCommitment(fields) {
  const args = [];
  for (const [k, v] of Object.entries(fields)) {
    args.push(k, String(v));
  }
  return redis.xadd(ANCHOR_STREAM, '*', ...args);
}

/**
 * Get the current stream length (useful for monitoring).
 */
async function getQueueDepth() {
  return redis.xlen(ANCHOR_STREAM);
}

/**
 * Trim the stream to the last N entries to prevent unbounded growth.
 * Call this periodically from the anchor worker after successful processing.
 *
 * @param {number} maxLen - maximum entries to keep
 */
async function trimStream(maxLen = 10000) {
  return redis.xtrim(ANCHOR_STREAM, 'MAXLEN', '~', maxLen);
}

module.exports = { redis, enqueueCommitment, getQueueDepth, trimStream, ANCHOR_STREAM };
