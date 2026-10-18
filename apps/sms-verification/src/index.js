'use strict';

require('dotenv').config();
const express   = require('express');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool }  = require('pg');
const { verifyCode } = require('@sacco/shared');
const logger = require('./logger');

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(helmet());
app.use(express.json());

// Strict rate limiter: 3 attempts per phone per 15 minutes
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.body.phoneNumber || req.ip,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});

/**
 * POST /sms/verify
 *
 * Body: { phoneNumber, code, receiptId }
 *
 * The member sends the 6-character code they received on their feature phone.
 * The service checks the code, checks the phone binding, and returns
 * the transaction details + anchoring status.
 */
app.post('/sms/verify', verifyLimiter, async (req, res) => {
  const { phoneNumber, code, receiptId } = req.body;

  if (!phoneNumber || !code || !receiptId) {
    return res.status(400).json({ error: 'phoneNumber, code and receiptId are required' });
  }

  const client = await pool.connect();
  try {
    // Fetch commitment + tenant HMAC key
    const { rows } = await client.query(
      `SELECT c.receipt_id, c.tx_ref, c.tx_type, c.amount,
              c.tx_timestamp, c.sequence_no, c.status,
              c.sms_code, c.batch_id, c.block_number,
              t.hmac_key_hex,
              sv.phone_number AS registered_phone,
              sv.attempts, sv.locked_until
       FROM commitments c
       JOIN tenants t ON t.id = c.tenant_id
       LEFT JOIN sms_verifications sv ON sv.receipt_id = c.receipt_id
       WHERE c.receipt_id = $1`,
      [receiptId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const row = rows[0];

    // Check lockout
    if (row.locked_until && new Date(row.locked_until) > new Date()) {
      return res.status(429).json({
        error: 'Phone number locked after 3 failed attempts',
        lockedUntil: row.locked_until,
      });
    }

    // Check phone binding
    if (row.registered_phone && row.registered_phone !== phoneNumber) {
      return res.status(403).json({ error: 'Phone number does not match this receipt' });
    }

    // Verify code
    const valid = verifyCode(code, receiptId, row.hmac_key_hex);

    if (!valid) {
      // Increment attempts
      const attempts = (row.attempts || 0) + 1;
      const lockUntil = attempts >= 3
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null;

      await client.query(
        `UPDATE sms_verifications
         SET attempts = $1, locked_until = $2, last_attempt_at = NOW()
         WHERE receipt_id = $3`,
        [attempts, lockUntil, receiptId]
      );

      logger.warn('SMS verification failed', { receiptId, attempts });
      return res.status(401).json({
        error: 'Invalid verification code',
        attemptsRemaining: Math.max(0, 3 - attempts),
      });
    }

    // Success — mark verified
    await client.query(
      `UPDATE sms_verifications
       SET verified_at = NOW(), attempts = 0, locked_until = NULL
       WHERE receipt_id = $1`,
      [receiptId]
    );

    logger.info('SMS verification success', { receiptId, phoneNumber });

    res.json({
      verified:    true,
      receiptId:   row.receipt_id,
      txRef:       row.tx_ref,
      txType:      row.tx_type,
      amount:      row.amount,
      txTimestamp: row.tx_timestamp,
      sequenceNo:  row.sequence_no,
      status:      row.status,
      blockNumber: row.block_number || null,
      message:     row.status === 'ANCHORED'
        ? 'Transaction is recorded and anchored on the blockchain.'
        : 'Transaction is recorded and pending blockchain anchoring.',
    });
  } catch (err) {
    logger.error('SMS verify error', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * POST /sms/send
 * Sends the verification code to a member's phone via Africa's Talking.
 */
app.post('/sms/send', async (req, res) => {
  const { phoneNumber, receiptId } = req.body;
  if (!phoneNumber || !receiptId) {
    return res.status(400).json({ error: 'phoneNumber and receiptId are required' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT sms_code FROM commitments WHERE receipt_id = $1',
      [receiptId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Receipt not found' });

    const code    = rows[0].sms_code;
    const message = `Your SACCO receipt code: ${code}. Reply with this code to verify your transaction.`;

    if (process.env.AT_API_KEY && process.env.AT_API_KEY !== 'sandbox') {
      const AT = require('africastalking')({
        apiKey:   process.env.AT_API_KEY,
        username: process.env.AT_USERNAME || 'sandbox',
      });
      await AT.SMS.send({
        to:      [phoneNumber],
        message,
        from:    process.env.AT_SENDER_ID || 'SACCO',
      });
      logger.info('SMS sent via Africa\'s Talking', { phoneNumber, receiptId });
    } else {
      // Sandbox / dev mode — just log
      logger.info('DEV SMS (not sent)', { phoneNumber, code, message });
    }

    res.json({ sent: true, message: 'Verification code sent' });
  } catch (err) {
    logger.error('SMS send error', { err: err.message });
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.SMS_PORT || 3002;
app.listen(PORT, () => logger.info(`SMS verification service on port ${PORT}`));
