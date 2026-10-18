'use strict';

const crypto = require('crypto');

/**
 * Canonicalise a transaction payload into a deterministic byte string.
 * Fields are sorted alphabetically, values are lowercased strings.
 * No PII goes on-chain — only pseudonymous fields are included.
 */
function canonicalise(tx) {
  const fields = {
    acct_pseudo:   String(tx.acct_pseudo),
    amount:        String(tx.amount),
    sequence_no:   String(tx.sequence_no),
    tenant_id:     String(tx.tenant_id),
    tx_ref:        String(tx.tx_ref),
    tx_timestamp:  String(tx.tx_timestamp),
    tx_type:       String(tx.tx_type),
  };
  // Sort keys and join as "key=value|key=value|..."
  return Object.keys(fields)
    .sort()
    .map(k => `${k}=${fields[k]}`)
    .join('|');
}

/**
 * Compute the salted SHA-256 leaf commitment for a transaction.
 * leaf_i = SHA-256(canon(tx_i) || salt_i)
 *
 * @param {object} tx  - transaction fields
 * @param {Buffer} salt - 16-byte random salt
 * @returns {Buffer}
 */
function computeLeaf(tx, salt) {
  const canon = canonicalise(tx);
  return crypto
    .createHash('sha256')
    .update(Buffer.from(canon, 'utf8'))
    .update(salt)
    .digest();
}

/**
 * Extend the hash chain.
 * chain_i = SHA-256(chain_(i-1) || leaf_i || seq_i_bytes)
 *
 * @param {Buffer} prevChain  - previous chain value (32 bytes; zeros for first)
 * @param {Buffer} leaf       - leaf commitment (32 bytes)
 * @param {bigint|number} seq - sequence number
 * @returns {Buffer}
 */
function extendChain(prevChain, leaf, seq) {
  const seqBuf = Buffer.alloc(8);
  seqBuf.writeBigUInt64BE(BigInt(seq));
  return crypto
    .createHash('sha256')
    .update(prevChain)
    .update(leaf)
    .update(seqBuf)
    .digest();
}

/**
 * Generate a cryptographically random 16-byte salt.
 * @returns {Buffer}
 */
function generateSalt() {
  return crypto.randomBytes(16);
}

module.exports = { canonicalise, computeLeaf, extendChain, generateSalt };
