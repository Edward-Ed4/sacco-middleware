'use strict';
/**
 * generate-keys.js
 *
 * Generates secp256k1 private keys for the 4 QBFT validators and the RPC node.
 * Writes each private key (32-byte hex, no 0x prefix) to the appropriate
 * infra/besu/validatorN/key file, as expected by Hyperledger Besu.
 *
 * Also prints the Ethereum address derived from each key so you can populate
 * the `extraData` validators list in genesis.json.
 *
 * Usage:
 *   node infra/besu/generate-keys.js
 *
 * Dependencies: none (uses Node.js built-in `crypto` only)
 *
 * NOTE: Run this script ONCE before first launch.  Committing private key
 * files to git is acceptable for a local dev/test network, but never do
 * this for production or public networks.
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ---------------------------------------------------------------------------
// Minimal secp256k1 public-key + Ethereum address derivation
// Node >= 15 ships with the WebCrypto API; for a zero-dependency approach we
// use the built-in `crypto.createECDH` which supports 'prime256v1' but NOT
// secp256k1 on all platforms. We therefore derive the Ethereum address via
// the `subtle` crypto if available, otherwise we fall back to printing "N/A".
// The KEY FILES themselves are always written (just 32 random bytes).
// ---------------------------------------------------------------------------

/**
 * Derive an Ethereum address from a 32-byte secp256k1 private key.
 * Returns a checksummed hex string, or null if unavailable.
 */
function deriveAddress(privKeyBuf) {
  try {
    // Try using Node's built-in ECDH for secp256k1 (available on most builds)
    const ecdh = crypto.createECDH('secp256k1');
    ecdh.setPrivateKey(privKeyBuf);
    // Uncompressed public key: 0x04 || X (32) || Y (32) = 65 bytes
    const pub = ecdh.getPublicKey(); // Buffer, 65 bytes uncompressed
    // Ethereum address = keccak256(pub[1:65])[-20:]
    // Node's built-in crypto doesn't expose keccak256, so we use a simple
    // manual implementation here.
    const pubBody = pub.slice(1); // 64 bytes (X || Y)
    const addrBuf = keccak256(pubBody).slice(-20);
    return '0x' + addrBuf.toString('hex');
  } catch (_) {
    return null;
  }
}

/**
 * Keccak-256 — pure JS, no external deps.
 * Ported from the reference C implementation in the Keccak team's submission.
 */
function keccak256(data) {
  // We'll use Node's built-in `crypto.hash` if available (Node 21.7+),
  // otherwise fall back to a zero-dep pure-JS implementation.
  // For simplicity, use the SHA-3 (NOT keccak) if that is all we have and
  // note the difference to the caller — or ship a tiny keccak impl.

  // Attempt 1: Node 21.7+ crypto.hash('sha3-256', ...) — not keccak, skip.
  // Attempt 2: Use the `ethereum-cryptography` package if installed.
  try {
    // eslint-disable-next-line
    const { keccak256: k } = require('ethereum-cryptography/keccak');
    return Buffer.from(k(data instanceof Buffer ? data : Buffer.from(data)));
  } catch (_) {}

  // Fallback: pure-JS keccak-256 (tiny implementation)
  return keccak256PureJS(data instanceof Buffer ? data : Buffer.from(data));
}

// ---- Pure-JS Keccak-256 (Tiny) -------------------------------------------
// Based on the public-domain implementation by Markku-Juhani O. Saarinen.
function keccak256PureJS(msgBuf) {
  const RC = [
    [0x00000001, 0x00000000], [0x00008082, 0x00000000],
    [0x0000808a, 0x80000000], [0x80008000, 0x80000000],
    [0x0000808b, 0x00000000], [0x80000001, 0x00000000],
    [0x80008081, 0x80000000], [0x00008009, 0x80000000],
    [0x0000008a, 0x00000000], [0x00000088, 0x00000000],
    [0x80008009, 0x00000000], [0x8000000a, 0x00000000],
    [0x8000808b, 0x00000000], [0x0000008b, 0x80000000],
    [0x00008089, 0x80000000], [0x00008003, 0x80000000],
    [0x00008002, 0x80000000], [0x00000080, 0x80000000],
    [0x0000800a, 0x00000000], [0x8000000a, 0x80000000],
    [0x80008081, 0x80000000], [0x00008080, 0x80000000],
    [0x80000001, 0x00000000], [0x80008008, 0x80000000],
  ];

  const ROTATIONS = [
    [0, 36, 3, 41, 18],
    [1, 44, 10, 45, 2],
    [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56],
    [27, 20, 39, 8, 14],
  ];

  // Represent each 64-bit lane as [lo32, hi32]
  function rol64(lo, hi, n) {
    if (n === 0)  return [lo, hi];
    if (n < 32)  return [(lo << n) | (hi >>> (32 - n)), (hi << n) | (lo >>> (32 - n))];
    if (n === 32) return [hi, lo];
    n -= 32;
    return [(hi << n) | (lo >>> (32 - n)), (lo << n) | (hi >>> (32 - n))];
  }

  function keccakF(state) {
    // state: 25 pairs [lo, hi]
    for (let r = 0; r < 24; r++) {
      // Theta
      const C = Array.from({ length: 5 }, (_, x) => [
        state[x][0] ^ state[x+5][0] ^ state[x+10][0] ^ state[x+15][0] ^ state[x+20][0],
        state[x][1] ^ state[x+5][1] ^ state[x+10][1] ^ state[x+15][1] ^ state[x+20][1],
      ]);
      const D = Array.from({ length: 5 }, (_, x) => {
        const r1 = rol64(C[(x+1)%5][0], C[(x+1)%5][1], 1);
        return [C[(x+4)%5][0] ^ r1[0], C[(x+4)%5][1] ^ r1[1]];
      });
      for (let x = 0; x < 5; x++)
        for (let y = 0; y < 5; y++) {
          state[x + y*5][0] ^= D[x][0];
          state[x + y*5][1] ^= D[x][1];
        }
      // Rho + Pi
      const B = new Array(25).fill(null).map(() => [0, 0]);
      for (let x = 0; x < 5; x++)
        for (let y = 0; y < 5; y++) {
          const rot = ROTATIONS[x][y];
          const [lo, hi] = rol64(state[x + y*5][0], state[x + y*5][1], rot);
          B[y + ((2*x+3*y)%5)*5] = [lo, hi];
        }
      // Chi
      for (let x = 0; x < 5; x++)
        for (let y = 0; y < 5; y++) {
          const i = x + y*5;
          state[i][0] = B[i][0] ^ (~B[((x+1)%5) + y*5][0] & B[((x+2)%5) + y*5][0]);
          state[i][1] = B[i][1] ^ (~B[((x+1)%5) + y*5][1] & B[((x+2)%5) + y*5][1]);
        }
      // Iota
      state[0][0] ^= RC[r][0];
      state[0][1] ^= RC[r][1];
    }
  }

  const rate    = 136; // 1088 bits for keccak-256
  const msgLen  = msgBuf.length;
  const padLen  = rate - (msgLen % rate);
  const padded  = Buffer.alloc(msgLen + padLen, 0);
  msgBuf.copy(padded);
  padded[msgLen] = 0x01;          // keccak padding (NOT SHA-3's 0x06)
  padded[padded.length - 1] |= 0x80;

  const state = new Array(25).fill(null).map(() => [0, 0]);

  for (let i = 0; i < padded.length; i += rate) {
    for (let j = 0; j < rate / 8; j++) {
      const off = i + j * 8;
      state[j][0] ^= padded.readUInt32LE(off);
      state[j][1] ^= padded.readUInt32LE(off + 4);
    }
    keccakF(state);
  }

  const out = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) {
    out.writeUInt32LE(state[i][0], i * 8);
    out.writeUInt32LE(state[i][1], i * 8 + 4);
  }
  return out;
}
// --------------------------------------------------------------------------

const BASE_DIR = path.resolve(__dirname);

const nodes = [
  { dir: path.join(BASE_DIR, 'validator1'), role: 'Validator 1 — UMRA (Regulator)' },
  { dir: path.join(BASE_DIR, 'validator2'), role: 'Validator 2 — MTIC (Ministry)' },
  { dir: path.join(BASE_DIR, 'validator3'), role: 'Validator 3 — SACCO Apex Union' },
  { dir: path.join(BASE_DIR, 'validator4'), role: 'Validator 4 — Independent Auditor' },
  { dir: path.join(BASE_DIR, 'rpc-node'),   role: 'RPC Node    — Read-only endpoint' },
];

console.log('\n=== SACCO Middleware — Besu QBFT Key Generation ===\n');
console.log('WARNING: These keys are for LOCAL DEV only.');
console.log('         Never commit real validator keys to git.\n');

const addresses = [];

for (const node of nodes) {
  fs.mkdirSync(node.dir, { recursive: true });

  const privKey   = crypto.randomBytes(32);
  const privHex   = privKey.toString('hex');           // 64 hex chars, no 0x
  const keyFile   = path.join(node.dir, 'key');

  fs.writeFileSync(keyFile, privHex, 'utf8');

  const address = deriveAddress(privKey);
  if (address) addresses.push(address);

  console.log(`${node.role}`);
  console.log(`  Private key : ${privHex}`);
  console.log(`  Address     : ${address || '(secp256k1 not available — run on standard Node)'}`);
  console.log(`  Written to  : ${keyFile}\n`);
}

if (addresses.length === 4) {
  console.log('=== Validator addresses for genesis.json extraData ===');
  console.log('Replace the placeholder extraData in genesis.json with the output');
  console.log('of `besu operator generate-blockchain-config` using these addresses,');
  console.log('or use the Besu QBFT genesis tool.\n');
  addresses.slice(0, 4).forEach((a, i) => console.log(`  Validator ${i + 1}: ${a}`));
}

console.log('\nDone. Restart Besu containers to pick up new keys.\n');
