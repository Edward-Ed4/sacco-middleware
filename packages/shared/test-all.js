'use strict';

/**
 * Full shared package test suite.
 * Tests: commitment, Merkle, SMS code, hash chain, pseudonymise, canonicalise.
 * Run: node packages/shared/test-all.js
 */

const {
  generateSalt, computeLeaf, extendChain,
  buildTree, generateProof, verifyProof,
  generateCode, verifyCode,
  verifyChain, GENESIS_CHAIN,
  pseudonymise,
  canonicalise, missingFields,
} = require('./src');

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${name}`);
    failed++;
  }
}

// ── 1. Commitment ────────────────────────────────────────────────────────────
console.log('\n1. Commitment engine');
const salt = generateSalt();
assert(salt.length === 16, 'generateSalt returns 16 bytes');

const tx = {
  tenant_id: 'tenant-1', tx_ref: 'TXN-001', tx_type: 'deposit',
  amount: '150000', acct_pseudo: 'abc123', tx_timestamp: '2026-10-18T08:00:00Z',
  sequence_no: '1',
};
const leaf = computeLeaf(tx, salt);
assert(leaf.length === 32, 'computeLeaf returns 32 bytes');

const chain1 = extendChain(GENESIS_CHAIN, leaf, 1);
assert(chain1.length === 32, 'extendChain returns 32 bytes');

// Same inputs always produce same leaf
const leaf2 = computeLeaf(tx, salt);
assert(leaf.equals(leaf2), 'computeLeaf is deterministic');

// Different salt produces different leaf
const leaf3 = computeLeaf(tx, generateSalt());
assert(!leaf.equals(leaf3), 'Different salt produces different leaf');

// ── 2. Merkle Tree ───────────────────────────────────────────────────────────
console.log('\n2. Merkle tree');
const leaves = [leaf, chain1, generateSalt(), generateSalt(), generateSalt()];
const { root, layers } = buildTree(leaves);
assert(root.length === 32, 'buildTree returns 32-byte root');

for (let i = 0; i < leaves.length; i++) {
  const proof = generateProof(layers, i);
  const valid = verifyProof(leaves[i], proof, root);
  assert(valid, `Proof valid for leaf ${i}`);
}

// Wrong leaf fails proof
const badLeaf = generateSalt();
const proof0  = generateProof(layers, 0);
assert(!verifyProof(badLeaf, proof0, root), 'Wrong leaf fails proof');

// ── 3. SMS Code ──────────────────────────────────────────────────────────────
console.log('\n3. SMS verification code');
const hmacKey  = 'a'.repeat(64);
const code1    = generateCode('receipt-uuid-001', hmacKey);
assert(code1.length === 6, 'generateCode returns 6 chars');
assert(/^[0-9A-Z]+$/.test(code1), 'Code uses valid Crockford Base32 chars');
assert(verifyCode(code1, 'receipt-uuid-001', hmacKey), 'verifyCode succeeds for correct code');
assert(!verifyCode('AAAAAA', 'receipt-uuid-001', hmacKey), 'verifyCode fails for wrong code');
assert(!verifyCode(code1, 'receipt-uuid-002', hmacKey), 'verifyCode fails for wrong receiptId');

// ── 4. Hash Chain ────────────────────────────────────────────────────────────
console.log('\n4. Hash chain integrity');
const leaf4 = computeLeaf({ ...tx, sequence_no: '4' }, generateSalt());
const leaf5 = computeLeaf({ ...tx, sequence_no: '5' }, generateSalt());
const c1 = extendChain(GENESIS_CHAIN, leaf4, 1);
const c2 = extendChain(c1, leaf5, 2);

const result = verifyChain([
  { leafHex: leaf4.toString('hex'), chainHex: c1.toString('hex'), sequenceNo: 1 },
  { leafHex: leaf5.toString('hex'), chainHex: c2.toString('hex'), sequenceNo: 2 },
]);
assert(result.valid, 'Valid chain passes verification');

const brokenResult = verifyChain([
  { leafHex: leaf4.toString('hex'), chainHex: c1.toString('hex'), sequenceNo: 1 },
  { leafHex: computeLeaf({ ...tx, sequence_no: '99' }, generateSalt()).toString('hex'), chainHex: c2.toString('hex'), sequenceNo: 2 },
]);
assert(!brokenResult.valid, 'Modified leaf breaks chain verification');
assert(brokenResult.firstBrokenAt === 2, 'Correctly identifies break point');

// ── 5. Pseudonymisation ──────────────────────────────────────────────────────
console.log('\n5. Pseudonymisation');
const p1 = pseudonymise('ACC-12345', hmacKey);
const p2 = pseudonymise('ACC-12345', hmacKey);
const p3 = pseudonymise('ACC-99999', hmacKey);
assert(p1.length === 64, 'Pseudonym is 64 hex chars');
assert(p1 === p2, 'Same input produces same pseudonym (deterministic)');
assert(p1 !== p3, 'Different accounts produce different pseudonyms');

// ── 6. Canonicalisation ──────────────────────────────────────────────────────
console.log('\n6. Canonicalisation');
const canon = canonicalise(tx);
assert(typeof canon === 'string', 'canonicalise returns string');
assert(canon.includes('tx_ref=TXN-001'), 'Canon includes tx_ref');
assert(canon.includes('amount=150000'), 'Canon includes amount');
const missing = missingFields({ tx_ref: 'X' });
assert(missing.length > 0, 'missingFields detects missing required fields');

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED ✓');
}
