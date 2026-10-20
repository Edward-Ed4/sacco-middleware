'use strict';

const crypto = require('crypto');

/**
 * Hash chain utilities.
 *
 * The hash chain links every commitment to all previous ones,
 * making deletions detectable as gaps in the sequence.
 *
 * chain_i = SHA-256(chain_(i-1) || leaf_i || seq_i_as_uint64_be)
 *
 * The genesis chain value (before any transactions) is 32 zero bytes.
 */

const GENESIS_CHAIN = Buffer.alloc(32, 0);

/**
 * Compute the next chain value.
 *
 * @param {Buffer} prevChain - previous chain value (32 bytes)
 * @param {Buffer} leaf      - current leaf hash (32 bytes)
 * @param {bigint|number} seq - sequence number
 * @returns {Buffer} - new chain value (32 bytes)
 */
function extendChain(prevChain, leaf, seq) {
  if (!Buffer.isBuffer(prevChain) || prevChain.length !== 32) {
    throw new Error('prevChain must be a 32-byte Buffer');
  }
  if (!Buffer.isBuffer(leaf) || leaf.length !== 32) {
    throw new Error('leaf must be a 32-byte Buffer');
  }

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
 * Verify that a chain of commitments is internally consistent.
 * Checks that each chain value correctly extends the previous one.
 *
 * @param {Array<{leafHex, chainHex, sequenceNo}>} commitments - ordered by sequence_no ASC
 * @returns {{ valid: boolean, firstBrokenAt: number|null }}
 */
function verifyChain(commitments) {
  let prevChain = GENESIS_CHAIN;

  for (const c of commitments) {
    const leaf     = Buffer.from(c.leafHex, 'hex');
    const expected = extendChain(prevChain, leaf, c.sequenceNo);
    const actual   = Buffer.from(c.chainHex, 'hex');

    if (!expected.equals(actual)) {
      return { valid: false, firstBrokenAt: c.sequenceNo };
    }
    prevChain = actual;
  }

  return { valid: true, firstBrokenAt: null };
}

module.exports = { extendChain, verifyChain, GENESIS_CHAIN };
