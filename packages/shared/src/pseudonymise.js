'use strict';

const crypto = require('crypto');

/**
 * Pseudonymisation utilities for DPPA compliance.
 *
 * The Data Protection and Privacy Act, 2019 (Uganda) requires that
 * personal data never appear on an immutable ledger.
 *
 * These helpers are used by the SACCO integration adapter to convert
 * real account numbers and member IDs into deterministic pseudonyms
 * before sending to the commit endpoint.
 *
 * The pseudonym is a SHA-256 HMAC under a tenant-specific key, so:
 * - The same account always maps to the same pseudonym (deterministic)
 * - The pseudonym cannot be reversed without the key (unlinkable to outsiders)
 * - The key is held only by the SACCO, not by the middleware
 */

/**
 * Pseudonymise a real account number.
 *
 * @param {string} accountNumber - real account number (never leaves SACCO)
 * @param {string} tenantKeyHex  - 32-byte HMAC key held by the SACCO (hex)
 * @returns {string}             - 64-char hex pseudonym
 */
function pseudonymise(accountNumber, tenantKeyHex) {
  return crypto
    .createHmac('sha256', Buffer.from(tenantKeyHex, 'hex'))
    .update(String(accountNumber))
    .digest('hex');
}

/**
 * Pseudonymise a phone number for SMS binding.
 * Uses a separate domain separator to avoid pseudonym collisions
 * between account numbers and phone numbers.
 *
 * @param {string} phoneNumber  - real phone number
 * @param {string} tenantKeyHex - 32-byte HMAC key (hex)
 * @returns {string}            - 64-char hex pseudonym
 */
function pseudonymisePhone(phoneNumber, tenantKeyHex) {
  return crypto
    .createHmac('sha256', Buffer.from(tenantKeyHex, 'hex'))
    .update('phone:' + String(phoneNumber))
    .digest('hex');
}

module.exports = { pseudonymise, pseudonymisePhone };
