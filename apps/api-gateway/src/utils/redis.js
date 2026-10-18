'use strict';

const Redis  = require('ioredis');
const logger = require('./logger');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableReadyCheck:     true,
  lazyConnect:          false,
});

redis.on('connect',  () => logger.info('Redis connected'));
redis.on('error',    (err) => logger.error('Redis error', { err: err.message }));
redis.on('close',    () => logger.warn('Redis connection closed'));

// Stream name for the anchor queue
const ANCHOR_STREAM = 'sacco:anchor:queue';

/**
 * Append a commitment to the anchor stream.
 * @param {object} fields - flat key/value object (all values must be strings)
 * @returns {string} - stream entry ID
 */
async function enqueueCommitment(fields) {
  const args = [];
  for (const [k, v] of Object.entries(fields)) {
    args.push(k, String(v));
  }
  return redis.xadd(ANCHOR_STREAM, '*', ...args);
}

module.exports = { redis, enqueueCommitment, ANCHOR_STREAM };
