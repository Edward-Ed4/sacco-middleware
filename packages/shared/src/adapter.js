'use strict';

/**
 * SACCO Integration Adapter SDK
 *
 * This is the code a SACCO software vendor integrates into their
 * existing system (MOBIS, Saccowave, SaccoSys, etc.) to connect
 * to the middleware plug-in.
 *
 * Usage:
 *   const { SaccoAdapter } = require('@sacco/shared');
 *
 *   const adapter = new SaccoAdapter({
 *     gatewayUrl:  'https://middleware.yoursacco.ug',
 *     apiKey:      process.env.SACCO_API_KEY,
 *     hmacKeyHex:  process.env.SACCO_HMAC_KEY,
 *   });
 *
 *   // Call this immediately after recording a transaction in your DB
 *   const receipt = await adapter.commit({
 *     txRef:       'TXN-2026-001',
 *     txType:      'deposit',
 *     amount:      150000,
 *     acctPseudo:  adapter.pseudonymise(rawAccountNumber),
 *     txTimestamp: new Date().toISOString(),
 *     sequenceNo:  nextSeq,
 *     phoneNumber: '+256700000000',
 *   });
 *
 *   // Print receipt.verificationCode on the paper receipt
 *   // Encode receipt.qrPayload as a QR code on the receipt
 */

const crypto = require('crypto');
const { pseudonymise } = require('./pseudonymise');
const { canonicaliseJson } = require('./canonicalJson');

class SaccoAdapter {
  /**
   * @param {object} config
   * @param {string} config.gatewayUrl  - API Gateway base URL
   * @param {string} config.apiKey      - Tenant API key
   * @param {string} config.hmacKeyHex  - Tenant HMAC key (32 bytes hex)
   */
  constructor({ gatewayUrl, apiKey, hmacKeyHex }) {
    if (!gatewayUrl || !apiKey || !hmacKeyHex) {
      throw new Error('gatewayUrl, apiKey and hmacKeyHex are required');
    }
    this._gatewayUrl  = gatewayUrl.replace(/\/$/, '');
    this._apiKey      = apiKey;
    this._hmacKeyHex  = hmacKeyHex;
  }

  /**
   * Pseudonymise an account number before sending to the middleware.
   * The real account number never leaves your system.
   *
   * @param {string} accountNumber
   * @returns {string} 64-char hex pseudonym
   */
  pseudonymise(accountNumber) {
    return pseudonymise(accountNumber, this._hmacKeyHex);
  }

  /**
   * Commit a transaction to the middleware.
   * Call this right after saving the transaction in your database.
   *
   * @param {object} tx
   * @returns {Promise<{ receiptId, qrPayload, verificationCode, status }>}
   */
  async commit(tx) {
    const payload = {
      tx_ref: tx.tx_ref ?? tx.txRef,
      tx_type: tx.tx_type ?? tx.txType,
      amount: tx.amount,
      acct_pseudo: tx.acct_pseudo ?? tx.acctPseudo,
      tx_timestamp: tx.tx_timestamp ?? tx.txTimestamp,
      sequence_no: tx.sequence_no ?? tx.sequenceNo,
      phone_number: tx.phone_number ?? tx.phoneNumber,
    };
    const body    = JSON.stringify(payload);
    const hmac    = this._computeHmac(body);
    const url     = `${this._gatewayUrl}/v1/commit`;

    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-API-Key':       this._apiKey,
        'X-Request-HMAC':  hmac,
      },
      body,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Commit failed (${response.status}): ${err.error || JSON.stringify(err)}`);
    }

    return response.json();
  }

  /**
   * Compute HMAC-SHA256 of the request body.
   * @param {string} body - raw JSON string
   * @returns {string} hex
   */
  _computeHmac(body) {
    return crypto
      .createHmac('sha256', Buffer.from(this._hmacKeyHex, 'hex'))
      .update(canonicaliseJson(JSON.parse(body)))
      .digest('hex');
  }
}

module.exports = { SaccoAdapter };
