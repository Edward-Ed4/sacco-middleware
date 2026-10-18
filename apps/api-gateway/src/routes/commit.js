'use strict';

const express      = require('express');
const authenticate = require('../middleware/authenticate');
const { processCommit } = require('../services/commitService');

const router = express.Router();

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
router.post('/', authenticate, async (req, res, next) => {
  try {
    const result = await processCommit(req.tenant, req.body);
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
