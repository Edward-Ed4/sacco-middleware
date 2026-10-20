'use strict';

const crypto = require('crypto');

/**
 * Generate a new Ed25519 key pair for a tenant's receipt signing.
 * Returns { privateKeyHex, publicKeyHex }
 */
function generateEd25519KeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    privateKeyHex: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex'),
    publicKeyHex:  publicKey.export({ type: 'spki', format: 'der' }).toString('hex'),
  };
}

/**
 * Generate a random 32-byte HMAC key (hex).
 */
function generateHmacKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a secure random API key (64 hex chars).
 */
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Constant-time hex string comparison.
 */
function safeCompare(a, b) {
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

module.exports = { generateEd25519KeyPair, generateHmacKey, generateApiKey, safeCompare };
