'use strict';

/**
 * SMS verification code generator and verifier.
 *
 * The code is the first 6 characters of a Crockford Base32 encoding
 * of an HMAC-SHA256 of the receipt ID under a tenant-specific key.
 * This gives 32^6 ≈ 1.07 × 10^9 possible codes.
 *
 * The service also binds the code to the member's phone number,
 * and locks the number out after 3 consecutive failures.
 */

const crypto = require('crypto');

// Crockford Base32 alphabet (excludes I, L, O, U to avoid confusion)
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Encode a Buffer as Crockford Base32.
 * @param {Buffer} buf
 * @returns {string}
 */
function crockfordEncode(buf) {
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += CROCKFORD[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    result += CROCKFORD[(value << (5 - bits)) & 0x1f];
  }
  return result;
}

/**
 * Generate a 6-character SMS verification code.
 *
 * code = first 6 chars of Crockford-Base32(HMAC-SHA256(receiptId, tenantHmacKey))
 *
 * @param {string} receiptId      - UUID of the commitment
 * @param {string} hmacKeyHex     - 32-byte tenant HMAC key (hex)
 * @returns {string}              - 6-character uppercase code
 */
function generateCode(receiptId, hmacKeyHex) {
  const key = Buffer.from(hmacKeyHex, 'hex');
  const mac = crypto
    .createHmac('sha256', key)
    .update(Buffer.from(receiptId, 'utf8'))
    .digest();

  return crockfordEncode(mac).substring(0, 6).toUpperCase();
}

/**
 * Verify a code submitted by a member.
 *
 * @param {string} submittedCode  - code entered by the member
 * @param {string} receiptId      - receipt UUID
 * @param {string} hmacKeyHex     - tenant HMAC key
 * @returns {boolean}
 */
function verifyCode(submittedCode, receiptId, hmacKeyHex) {
  const expected = generateCode(receiptId, hmacKeyHex);
  // Constant-time comparison to prevent timing attacks
  const a = Buffer.from(submittedCode.toUpperCase().padEnd(6, ' '));
  const b = Buffer.from(expected.padEnd(6, ' '));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { generateCode, verifyCode, crockfordEncode };
