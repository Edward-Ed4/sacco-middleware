'use strict';

const crypto  = require('crypto');
const { v4: uuidv4 } = require('uuid');

const {
  generateSalt,
  computeLeaf,
  extendChain,
  generateCode,
  signReceipt,
} = require('@sacco/shared');

const { query, getClient } = require('../utils/db');
const { enqueueCommitment } = require('../utils/redis');
const logger = require('../utils/logger');

/**
 * Process a single commit request from a SACCO adapter.
 *
 * Steps:
 * 1. Fetch last chain value for the tenant (chain continuity)
 * 2. Compute salt, leaf, chain value
 * 3. Generate receipt ID, QR payload (Ed25519-signed), SMS code
 * 4. Persist commitment as PENDING in PostgreSQL (transaction)
 * 5. Enqueue on Redis Stream for the anchor worker
 * 6. Return 202 Accepted with receipt
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
    phone_number,
  } = payload;

  // ── Fetch last chain value ────────────────────────────────────────────────
  const chainRes = await query(
    `SELECT chain_hex FROM commitments
     WHERE tenant_id = $1
     ORDER BY sequence_no DESC
     LIMIT 1`,
    [tenant.id]
  );

  const prevChain = chainRes.rows.length > 0
    ? Buffer.from(chainRes.rows[0].chain_hex, 'hex')
    : Buffer.alloc(32, 0); // genesis

  // ── Compute cryptographic values ─────────────────────────────────────────
  const salt   = generateSalt();
  const txData = {
    tenant_id:    tenant.id,
    tx_ref:       String(tx_ref),
    tx_type:      String(tx_type),
    amount:       String(amount),
    acct_pseudo:  String(acct_pseudo),
    tx_timestamp: String(tx_timestamp),
    sequence_no:  String(sequence_no),
  };

  const leaf      = computeLeaf(txData, salt);
  const chain     = extendChain(prevChain, leaf, sequence_no);
  const receiptId = uuidv4();

  // ── Generate SMS code ─────────────────────────────────────────────────────
  const smsCode = generateCode(receiptId, tenant.hmac_key_hex);

  // ── Build signed QR payload ───────────────────────────────────────────────
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

  let qrPayload;
  if (process.env.SIGNING_PRIVATE_KEY) {
    try {
      qrPayload = signReceipt(qrFields, process.env.SIGNING_PRIVATE_KEY);
    } catch (err) {
      logger.warn('Receipt signing failed — using unsigned payload', { err: err.message });
      qrPayload = Buffer.from(JSON.stringify({ ...qrFields, sig: 'UNSIGNED' })).toString('base64url');
    }
  } else {
    qrPayload = Buffer.from(JSON.stringify({ ...qrFields, sig: 'UNSIGNED_DEV' })).toString('base64url');
    logger.warn('SIGNING_PRIVATE_KEY not set — QR payload unsigned (dev mode)');
  }

  // ── Persist PENDING commitment ────────────────────────────────────────────
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
        Number(sequence_no), salt.toString('hex'),
        leaf.toString('hex'), chain.toString('hex'),
        receiptId, qrPayload, smsCode,
      ]
    );

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

  // ── Enqueue for async anchoring ───────────────────────────────────────────
  await enqueueCommitment({
    tenantId:   tenant.id,
    receiptId,
    leafHex:    leaf.toString('hex'),
    chainHex:   chain.toString('hex'),
    sequenceNo: String(sequence_no),
  });

  logger.info('Commitment created', { tenantId: tenant.id, receiptId, txRef: tx_ref });

  return { receiptId, qrPayload, verificationCode: smsCode, status: 'PENDING' };
}

module.exports = { processCommit };
