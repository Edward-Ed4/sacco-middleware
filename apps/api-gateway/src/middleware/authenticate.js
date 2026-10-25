'use strict';

const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const { query } = require('../utils/db');
const logger   = require('../utils/logger');

// In-memory tenant cache (TTL 5 minutes) to avoid DB hit on every request
const tenantCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function canonicaliseForHmac(value) {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => canonicaliseForHmac(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicaliseForHmac(value[key])}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

async function getTenant(apiKey) {
  // Hash the raw key for lookup (bcrypt compare)
  // We store a cache entry keyed by the raw key hash for speed
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  if (tenantCache.has(keyHash)) {
    const cached = tenantCache.get(keyHash);
    if (Date.now() - cached.ts < CACHE_TTL_MS) return cached.tenant;
    tenantCache.delete(keyHash);
  }

  // Fetch all active tenants and bcrypt-compare (small N, acceptable)
  const { rows } = await query(
    'SELECT id, name, api_key_hash, hmac_key_hex, signing_pub FROM tenants WHERE active = TRUE',
    []
  );

  for (const row of rows) {
    const match = await bcrypt.compare(apiKey, row.api_key_hash);
    if (match) {
      tenantCache.set(keyHash, { tenant: row, ts: Date.now() });
      return row;
    }
  }
  return null;
}

/**
 * Middleware: validate API key + HMAC request signature.
 *
 * Headers expected:
 *   X-API-Key:       <tenant api key>
 *   X-Request-HMAC:  <hex HMAC-SHA256 of raw request body using tenant's hmac_key_hex>
 */
async function authenticate(req, res, next) {
  try {
    const apiKey   = req.headers['x-api-key'];
    const reqHmac  = req.headers['x-request-hmac'];

    if (!apiKey || !reqHmac) {
      return res.status(401).json({ error: 'Missing X-API-Key or X-Request-HMAC header' });
    }

    const tenant = await getTenant(apiKey);
    if (!tenant) {
      logger.warn('Authentication failed - unknown API key');
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Verify HMAC over a canonical body representation so equivalent JSON
    // objects with different key ordering still produce the same signature.
    const rawBody  = canonicaliseForHmac(req.body);
    const expected = crypto
      .createHmac('sha256', Buffer.from(tenant.hmac_key_hex, 'hex'))
      .update(rawBody)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(reqHmac, 'hex'), Buffer.from(expected, 'hex'))) {
      logger.warn('Authentication failed - invalid HMAC', { tenantId: tenant.id });
      return res.status(401).json({ error: 'Invalid request signature' });
    }

    req.tenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authenticate;
