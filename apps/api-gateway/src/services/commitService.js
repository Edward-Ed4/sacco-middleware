'use strict';

const crypto  = require('crypto');
const { v4: uuidv4 } = require('uuid');

const {
  generateSalt,
  computeLeaf,
  extendChain,
  generateCode,
} = require('@sacco/shared');

const { query, getClient } = require('../utils/db');
const { enqueueCommitment } = require('../utils/redis');
const logger = require('../utils/logger');

/**
 * Process a single commit request from a SACCO adapter.
 *
 * Steps:
 * 1. Validate payload
 * 2. Fetch last chain value for the tenant (for chain continuity)
 * 3. Compute salt, leaf, chain
 * 4. Generate receipt ID, QR payload (signed), SMS code
 * 5. Persist commitment as PENDING in PostgreSQL
 * 6. Enqueue on Redis Stream for the anchor worker
 * 7. Return 202 Accepted with receipt
 *
 * Target p95 latency: ≤ 50 ms
 */
async function processCommit(tenant, payload) {
  const {
    tx_ref,
    tx_type,
    amount,
    acct_pseudo,
    tx_timestamp,
    sequence_no,
    phone_number, // optional — for SMS verification binding
  } = payload;

  // ── 1. Basic validation ───────────────────────────────────────────────────
  if (!tx_ref || !tx_type || amount == null || !acct_pseudo || !tx_timestamp || sequence_no == null) {
    const err = new Error('Missing required fields: tx_ref, tx_type, amount, acct_pseudo, tx_timestamp, sequence_no');
    err.status = 400;
    throw err;
  }

  const validTypes = ['deposit', 'withdrawal', 'loan', 'repayment', 'transfer'];
  if (!validTypes.includes(tx_type)) {
    const err = new Error(`Invalid tx_type. Must be one of: ${validTypes.join(', ')}`);
    err.status = 400;
    throw err;
  }

  // ── 2. Fetch last chain value for this tenant ─────────────────────────────
  const chainRes = await query(
    `SELECT chain_hex FROM commitments
     WHERE tenant_id = $1
     ORDER BY sequence_no DESC
     LIMIT 1`,
    [tenant.id]
  );

  const prevChain = chainRes.rows.length > 0
    ? Buffer.from(chainRes.rows[0].chain_hex, 'hex')
    : Buffer.alloc(32, 0); // genesis — all zeros

  // ── 3. Compute cryptographic values ──────────────────────────────────────
  const salt    = generateSalt();
  const txData  = {
    tenant_id:    tenant.id,
    tx_ref:       String(tx_ref),
    tx_type:      String(tx_type),
    amount:       String(amount),
    acct_pseudo:  String(acct_pseudo),
    tx_timestamp: String(tx_timestamp),
    sequence_no:  String(sequence_no),
  };

  const leaf       = computeLeaf(txData, salt);
  const chain      = extendChain(prevChain, leaf, sequence_no);
  const receiptId  = uuidv4();

  // ── 4. Generate SMS code ──────────────────────────────────────────────────
  const smsCode = generateCode(receiptId, tenant.hmac_key_hex);

  // ── 5. Build QR payload (Ed25519-signed) ─────────────────────────────────
  // We store the QR payload as a signed JSON; signing uses the gateway's
  // private key (stored in env, not per-tenant, for simplicity in prototype).
  // In production each tenant gets their own signing key pair.
  const qrFields = {
    tenantId:    tenant.id,
    receiptId,
    txRef:       String(tx_ref),
    txType:      String(tx_type),
    amount:      String(amount),
    acctPseudo:  String(acct_pseudo),
    txTimestamp: String(tx_timestamp),
    sequenceNo:  String(sequence_no),
    saltHex:     salt.toString('hex'),
    leafHex:     leaf.toString('hex'),
  };

  // Sign with gateway Ed25519 key if available, else produce unsigned payload
  let qrPayload;
  if (process.env.SIGNING_PRIVATE_KEY) {
    const { signReceipt } = require('@sacco/shared');
    qrPayload = signReceipt(qrFields, process.env.SIGNING_PRIVATE_KEY);
  } else {
    // Development fallback — base64url-encode without signature
    qrPayload = Buffer.from(JSON.stringify({ ...qrFields, sig: 'UNSIGNED_DEV' })).toString('base64url');
    logger.warn('SIGNING_PRIVATE_KEY not set — QR payload is unsigned (dev only)');
  }

  // ── 6. Persist PENDING commitment ─────────────────────────────────────────
  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO commitments
         (id, tenant_id, tx_ref, tx_type, amount, acct_pseudo,
          tx_timestamp, sequence_no, salt_hex, leaf_hex, chain_hex,
          status, receipt_id, qr_payload, sms_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDING',$12,$13,$14)`,
      [
        uuidv4(), tenant.id, String(tx_ref), String(tx_type),
        String(amount), String(acct_pseudo), String(tx_timestamp),
        Number(sequence_no), salt.toString('hex'), leaf.toString('hex'),
        chain.toString('hex'), receiptId, qrPayload, smsCode,
      ]
    );

    // Bind phone number for SMS verification if provided
    if (phone_number) {
      await client.query(
        `INSERT INTO sms_verifications (receipt_id, phone_number)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [receiptId, String(phone_number)]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // ── 7. Enqueue for async anchoring ───────────────────────────────────────
  await enqueueCommitment({
    tenantId:   tenant.id,
    receiptId,
    leafHex:    leaf.toString('hex'),
    chainHex:   chain.toString('hex'),
    sequenceNo: String(sequence_no),
  });

  logger.info('Commitment created', { tenantId: tenant.id, receiptId, txRef: tx_ref });

  return {
    receiptId,
    qrPayload,
    verificationCode: smsCode,
    status: 'PENDING',
  };
}

module.exports = { processCommit };
