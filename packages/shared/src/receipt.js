'use strict';

/**
 * Receipt issuer — builds and verifies the Ed25519-signed QR payload.
 *
 * The QR payload is a base64url-encoded JSON string:
 * {
 *   tenantId, receiptId, txRef, txType, amount,
 *   acctPseudo, txTimestamp, sequenceNo,
 *   saltHex, leafHex,
 *   sig: <Ed25519 signature over canonical JSON fields, hex>
 * }
 *
 * We use Node's built-in crypto (Ed25519 support added in Node 15+).
 */

const crypto = require('crypto');

/**
 * Build the canonical string that gets signed.
 * Only deterministic fields — no sig field.
 */
function _signingInput(fields) {
  const ordered = {
    tenantId:    fields.tenantId,
    receiptId:   fields.receiptId,
    txRef:       fields.txRef,
    txType:      fields.txType,
    amount:      String(fields.amount),
    acctPseudo:  fields.acctPseudo,
    txTimestamp: fields.txTimestamp,
    sequenceNo:  String(fields.sequenceNo),
    saltHex:     fields.saltHex,
    leafHex:     fields.leafHex,
  };
  return Buffer.from(JSON.stringify(ordered), 'utf8');
}

/**
 * Sign receipt fields with an Ed25519 private key.
 *
 * @param {object} fields        - receipt fields (see above)
 * @param {string} privKeyHex    - 32-byte Ed25519 private key seed (hex)
 * @returns {string}             - base64url-encoded QR payload
 */
function signReceipt(fields, privKeyHex) {
  const privKeyBuf = Buffer.from(privKeyHex, 'hex');
  const keyObj = crypto.createPrivateKey({
    key: privKeyBuf,
    format: 'der',
    type: 'pkcs8',
  });

  const input = _signingInput(fields);
  const sigBuf = crypto.sign(null, input, keyObj);

  const payload = { ...fields, sig: sigBuf.toString('hex') };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/**
 * Verify a QR payload signature.
 *
 * @param {string} qrPayload     - base64url-encoded QR payload
 * @param {string} pubKeyHex     - 32-byte Ed25519 public key (hex)
 * @returns {{ valid: boolean, fields: object }}
 */
function verifyReceipt(qrPayload, pubKeyHex) {
  try {
    const payload = JSON.parse(Buffer.from(qrPayload, 'base64url').toString('utf8'));
    const { sig, ...fields } = payload;

    const pubKeyBuf = Buffer.from(pubKeyHex, 'hex');
    const keyObj = crypto.createPublicKey({
      key: pubKeyBuf,
      format: 'der',
      type: 'spki',
    });

    const input = _signingInput(fields);
    const sigBuf = Buffer.from(sig, 'hex');
    const valid = crypto.verify(null, input, keyObj, sigBuf);

    return { valid, fields };
  } catch {
    return { valid: false, fields: null };
  }
}

module.exports = { signReceipt, verifyReceipt };
