'use strict';

/**
 * Writes the correct QBFT extraData into genesis.json.
 * Uses the validator addresses already printed by generate-keys.js.
 *
 * QBFT extraData = RLP([vanity(32 bytes), [addr1,addr2,addr3,addr4], [], 0, []])
 */

const fs   = require('fs');
const path = require('path');

// Validator addresses from generate-keys.js output
const validators = [
  '9d60bd474101ae0533bb7fb87752a151f42cba35', // validator1 - UMRA
  'e8576d08ae5664f434d9771d0d1fed185e3fb66b', // validator2 - MTIC
  '8f510c0e15ca8eb9cd2b0c0c96fd10502365d7b9', // validator3 - SACCO Union
  'dd7b3044e538374ab652f9b54ed37cf1f55f1251', // validator4 - Auditor
];

// ── RLP helpers ───────────────────────────────────────────────────────────────
function toBuf(hex) { return Buffer.from(hex, 'hex'); }

function rlpLen(len, offset) {
  if (len < 56) return Buffer.from([offset + len]);
  const b = [];
  let n = len;
  while (n > 0) { b.unshift(n & 0xff); n >>= 8; }
  return Buffer.concat([Buffer.from([offset + 55 + b.length]), Buffer.from(b)]);
}

function rlpItem(buf) {
  if (buf.length === 1 && buf[0] < 0x80) return buf;
  return Buffer.concat([rlpLen(buf.length, 0x80), buf]);
}

function rlpList(items) {
  const body = Buffer.concat(items.map(rlpItem));
  return Buffer.concat([rlpLen(body.length, 0xc0), body]);
}

// ── Build extraData ───────────────────────────────────────────────────────────
const vanity = Buffer.alloc(32, 0);           // 32 zero bytes
const addrs  = validators.map(toBuf);          // 20-byte addresses
const empty  = Buffer.alloc(0);               // empty bytes (for round=0 and empty lists)

// QBFT extraData RLP:
// [vanity, [validators...], [], 0, []]
const extraDataBuf = Buffer.concat([
  rlpItem(vanity),          // vanity bytes
  rlpList(addrs),           // validator list
  rlpList([]),              // vote list (empty)
  rlpItem(Buffer.from([0x80])).slice(1), // round 0 = 0x80 is RLP for empty string = integer 0
  rlpList([]),              // seals (empty)
]);

// Actually for QBFT the structure Besu expects is just a flat RLP list:
// RLP_LIST(vanity_bytes, RLP_LIST(validators), empty_list, 0, empty_list)
const inner = Buffer.concat([
  rlpItem(vanity),
  rlpList(addrs),
  rlpList([]),
  Buffer.from([0x80]),   // RLP encoding of integer 0
  rlpList([]),
]);

const extraData = '0x' + inner.toString('hex');

console.log('Validator addresses:');
validators.forEach((a, i) => console.log(`  validator${i+1}: 0x${a}`));
console.log('\nextraData:', extraData.substring(0, 40) + '...');

// Write to genesis.json
const genesisPath = path.join(__dirname, 'genesis.json');
const genesis = JSON.parse(fs.readFileSync(genesisPath, 'utf8'));
genesis.extraData = extraData;
fs.writeFileSync(genesisPath, JSON.stringify(genesis, null, 2));
console.log('\ngenesis.json updated successfully');
console.log('extraData length:', extraData.length, 'chars');
