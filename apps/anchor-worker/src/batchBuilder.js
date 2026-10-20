'use strict';

const { buildTree, generateProof } = require('@sacco/shared');

/**
 * Batch builder — takes an array of commitment items from Redis Streams
 * and constructs the Merkle tree with individual proofs for each leaf.
 *
 * Returns:
 * {
 *   root:   Buffer,               // 32-byte Merkle root
 *   rootHex: string,              // hex string of root
 *   proofs: [{ index, proof }],   // proof per commitment
 *   layers: Buffer[][]            // full tree layers (for debugging)
 * }
 */
function buildBatch(items) {
  if (!items || items.length === 0) {
    throw new Error('Cannot build batch from empty items');
  }

  const leaves = items.map(item => {
    const hex = item.leafHex;
    if (!hex || hex.length !== 64) {
      throw new Error(`Invalid leafHex for item ${item.receiptId}: "${hex}"`);
    }
    return Buffer.from(hex, 'hex');
  });

  const { root, layers } = buildTree(leaves);

  const proofs = items.map((item, index) => ({
    receiptId: item.receiptId,
    index,
    proof: generateProof(layers, index),
  }));

  return {
    root,
    rootHex: root.toString('hex'),
    proofs,
    layers,
    count: items.length,
  };
}

/**
 * Encode a UUID string (with dashes) as a 32-byte hex string for use as bytes32 in Solidity.
 * Strips dashes and left-pads to 64 hex chars.
 */
function uuidToBytes32(uuid) {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) {
    throw new Error(`Invalid UUID hex length: ${hex.length}`);
  }
  return '0x' + hex.padEnd(64, '0');
}

module.exports = { buildBatch, uuidToBytes32 };
