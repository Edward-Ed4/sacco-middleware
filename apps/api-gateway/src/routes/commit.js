'use strict';

const express      = require('express');
const rateLimit    = require('express-rate-limit');
const authenticate = require('../middleware/authenticate');
const { validateCommit } = require('../middleware/validate');
const { processCommit } = require('../services/commitService');

const router = express.Router();

// Tighter rate limit for commit endpoint: 200 req/min per tenant
const commitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
  message: { error: 'Commit rate limit exceeded' },
});

/**
 * POST /v1/commit
 *
 * Body:
 * {
 *   tx_ref:       string   (SACCO transaction reference)
 *   tx_type:      string   (deposit|withdrawal|loan|repayment|transfer)
 *   amount:       number
 *   acct_pseudo:  string   (pseudonymous account reference - hashed by adapter)
 *   tx_timestamp: string   (ISO 8601)
 *   sequence_no:  number   (monotonically increasing per tenant)
 *   phone_number: string   (optional - for SMS verification binding)
 * }
 *
 * Response 202:
 * {
 *   receiptId:        string (UUID)
 *   qrPayload:        string (base64url Ed25519-signed receipt)
 *   verificationCode: string (6-char Crockford Base32)
 *   status:           "PENDING"
 * }
 */
router.post('/', authenticate, commitLimiter, validateCommit, async (req, res, next) => {
  try {
    const result = await processCommit(req.tenant, req.body);
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
