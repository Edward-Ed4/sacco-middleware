'use strict';

const express  = require('express');
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../utils/db');

const router = express.Router();

/**
 * POST /v1/tenants/register
 *
 * Registers a new SACCO tenant.
 * Returns the plaintext API key once — it is not stored in plaintext.
 *
 * Body: { name: string }
 */
router.post('/register', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    // Generate credentials
    const rawApiKey    = crypto.randomBytes(32).toString('hex');
    const apiKeyHash   = await bcrypt.hash(rawApiKey, 10);
    const hmacKeyHex   = crypto.randomBytes(32).toString('hex');

    // Generate an Ed25519 key pair for receipt signing
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const pubKeyHex  = publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
    const privKeyHex = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex');

    const id = uuidv4();
    await query(
      `INSERT INTO tenants (id, name, api_key_hash, hmac_key_hex, signing_pub)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, name, apiKeyHash, hmacKeyHex, pubKeyHex]
    );

    // Return plaintext secrets ONCE — never stored in plaintext
    res.status(201).json({
      tenantId:   id,
      name,
      apiKey:     rawApiKey,        // store this securely — shown once only
      hmacKeyHex,                   // store this securely
      signingPrivateKeyHex: privKeyHex, // store this securely
      signingPublicKeyHex:  pubKeyHex,
      warning: 'Store these credentials securely. They will not be shown again.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/tenants/:id
 * Returns public tenant info (no secrets).
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, name, signing_pub, active, created_at FROM tenants WHERE id = $1',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
