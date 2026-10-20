'use strict';

const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../utils/db');
const logger   = require('../utils/logger');

/**
 * Tenant management service.
 * Handles registration, key rotation and deactivation.
 */

/**
 * Register a new SACCO tenant.
 * Generates an API key (shown once), HMAC key and Ed25519 key pair.
 *
 * @param {string} name - SACCO name
 * @returns {object} - tenant credentials (show once and store securely)
 */
async function registerTenant(name) {
  const rawApiKey  = crypto.randomBytes(32).toString('hex');
  const apiKeyHash = await bcrypt.hash(rawApiKey, 10);
  const hmacKeyHex = crypto.randomBytes(32).toString('hex');

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubKeyHex  = publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
  const privKeyHex = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex');

  const id = uuidv4();
  await query(
    `INSERT INTO tenants (id, name, api_key_hash, hmac_key_hex, signing_pub)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, name, apiKeyHash, hmacKeyHex, pubKeyHex]
  );

  logger.info('Tenant registered', { tenantId: id, name });

  return {
    tenantId:            id,
    name,
    apiKey:              rawApiKey,
    hmacKeyHex,
    signingPrivateKeyHex: privKeyHex,
    signingPublicKeyHex:  pubKeyHex,
  };
}

/**
 * Deactivate a tenant (soft delete).
 * @param {string} tenantId
 */
async function deactivateTenant(tenantId) {
  const result = await query(
    'UPDATE tenants SET active = FALSE WHERE id = $1',
    [tenantId]
  );
  if (result.rowCount === 0) throw Object.assign(new Error('Tenant not found'), { status: 404 });
  logger.info('Tenant deactivated', { tenantId });
}

/**
 * Get tenant stats (commitment counts, last anchored batch).
 * @param {string} tenantId
 */
async function getTenantStats(tenantId) {
  const { rows } = await query(
    `SELECT
       COUNT(*)                                         AS total_commitments,
       COUNT(*) FILTER (WHERE status = 'ANCHORED')      AS anchored,
       COUNT(*) FILTER (WHERE status = 'PENDING')       AS pending,
       MAX(created_at)                                  AS last_commitment_at
     FROM commitments WHERE tenant_id = $1`,
    [tenantId]
  );
  return rows[0];
}

module.exports = { registerTenant, deactivateTenant, getTenantStats };
