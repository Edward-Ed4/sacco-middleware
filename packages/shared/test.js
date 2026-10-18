'use strict';

const { generateSalt, computeLeaf, extendChain } = require('./src/commitment');
const { buildTree, generateProof, verifyProof } = require('./src/merkle');
const { generateCode, verifyCode } = require('./src/smsCode');

// Test commitment
const salt = generateSalt();
const tx = {
  tenant_id:    'abc',
  tx_ref:       'TX001',
  tx_type:      'deposit',
  amount:       '50000',
  acct_pseudo:  'hash123',
  tx_timestamp: '2026-10-18T00:00:00Z',
  sequence_no:  '1',
};
const leaf  = computeLeaf(tx, salt);
const prev  = Buffer.alloc(32, 0);
const chain = extendChain(prev, leaf, 1);
console.log('leaf :', leaf.toString('hex').substring(0, 16) + '...');
console.log('chain:', chain.toString('hex').substring(0, 16) + '...');

// Test Merkle tree
const leaves = [leaf, chain, generateSalt(), generateSalt()];
const { root, layers } = buildTree(leaves);
const proof = generateProof(layers, 0);
const valid = verifyProof(leaf, proof, root);
console.log('Merkle proof valid:', valid);

// Test SMS code
const code  = generateCode('receipt-uuid-1234', 'a'.repeat(64));
const match = verifyCode(code, 'receipt-uuid-1234', 'a'.repeat(64));
console.log('SMS code:', code, '| verify:', match);

if (valid && match) {
  console.log('\nAll crypto tests PASSED');
} else {
  console.error('\nSOME TESTS FAILED');
  process.exit(1);
}
