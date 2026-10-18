'use strict';

const crypto = require('crypto');

/**
 * Hash two child nodes together to form a parent node.
 * parent = SHA-256(left || right)
 */
function hashPair(left, right) {
  return crypto
    .createHash('sha256')
    .update(left)
    .update(right)
    .digest();
}

/**
 * Build a Merkle tree from an array of leaf Buffers (or hex strings).
 * Returns { root: Buffer, layers: Buffer[][] }
 * layers[0] = leaf layer, layers[last] = [root]
 * If the number of leaves is odd, the last leaf is duplicated.
 */
function buildTree(leaves) {
  if (!leaves || leaves.length === 0) {
    throw new Error('Cannot build Merkle tree from empty leaves');
  }

  const layers = [leaves.map(l => Buffer.isBuffer(l) ? l : Buffer.from(l, 'hex'))];
  let current = layers[0];

  while (current.length > 1) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const left  = current[i];
      const right = i + 1 < current.length ? current[i + 1] : current[i];
      next.push(hashPair(left, right));
    }
    layers.push(next);
    current = next;
  }

  return { root: current[0], layers };
}

/**
 * Generate a Merkle proof for the leaf at the given index.
 * Returns an array of { sibling: hex, position: 'left'|'right' }
 */
function generateProof(layers, index) {
  const proof = [];
  let idx = index;

  for (let i = 0; i < layers.length - 1; i++) {
    const layer = layers[i];
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;

    if (siblingIdx < layer.length) {
      proof.push({
        sibling:  layer[siblingIdx].toString('hex'),
        position: isRight ? 'left' : 'right',
      });
    } else {
      proof.push({
        sibling:  layer[idx].toString('hex'),
        position: isRight ? 'left' : 'right',
      });
    }
    idx = Math.floor(idx / 2);
  }

  return proof;
}

/**
 * Verify a Merkle proof.
 * @param {string|Buffer} leaf
 * @param {Array}         proof  - [{ sibling, position }]
 * @param {string|Buffer} root
 * @returns {boolean}
 */
function verifyProof(leaf, proof, root) {
  let current = Buffer.isBuffer(leaf) ? leaf : Buffer.from(leaf, 'hex');
  const expectedRoot = Buffer.isBuffer(root) ? root : Buffer.from(root, 'hex');

  for (const { sibling, position } of proof) {
    const sib = Buffer.from(sibling, 'hex');
    current = position === 'left'
      ? hashPair(sib, current)
      : hashPair(current, sib);
  }

  return current.equals(expectedRoot);
}

module.exports = { buildTree, generateProof, verifyProof, hashPair };
