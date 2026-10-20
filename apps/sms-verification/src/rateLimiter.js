'use strict';

const { Pool } = require('pg');
const logger   = require('./logger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MAX_ATTEMPTS  = 3;
const LOCKOUT_MS    = 15 * 60 * 1000; // 15 minutes

/**
 * Check if a phone number is locked out for a given receipt.
 * Returns { locked: true, lockedUntil } if locked, otherwise { locked: false }.
 */
async function checkLockout(receiptId, phoneNumber) {
  const { rows } = await pool.query(
    `SELECT attempts, locked_until FROM sms_verifications
     WHERE receipt_id = $1 AND phone_number = $2`,
    [receiptId, phoneNumber]
  );

  if (rows.length === 0) return { locked: false };

  const row = rows[0];
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    return { locked: true, lockedUntil: row.locked_until };
  }

  return { locked: false, attempts: row.attempts || 0 };
}

/**
 * Record a failed attempt. Locks the phone number after MAX_ATTEMPTS failures.
 * Returns the number of remaining attempts.
 */
async function recordFailure(receiptId, phoneNumber) {
  const current = await checkLockout(receiptId, phoneNumber);
  const attempts = (current.attempts || 0) + 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS
    ? new Date(Date.now() + LOCKOUT_MS).toISOString()
    : null;

  await pool.query(
    `INSERT INTO sms_verifications (receipt_id, phone_number, attempts, locked_until, last_attempt_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (receipt_id, phone_number)
     DO UPDATE SET attempts = $3, locked_until = $4, last_attempt_at = NOW()`,
    [receiptId, phoneNumber, attempts, lockedUntil]
  );

  if (lockedUntil) {
    logger.warn('Phone locked after max attempts', { phoneNumber, receiptId });
  }

  return Math.max(0, MAX_ATTEMPTS - attempts);
}

/**
 * Clear failure record on successful verification.
 */
async function recordSuccess(receiptId, phoneNumber) {
  await pool.query(
    `UPDATE sms_verifications
     SET attempts = 0, locked_until = NULL, verified_at = NOW()
     WHERE receipt_id = $1 AND phone_number = $2`,
    [receiptId, phoneNumber]
  );
}

module.exports = { checkLockout, recordFailure, recordSuccess, MAX_ATTEMPTS };
