'use strict';

/**
 * Standalone canonicalisation module — converts a transaction payload
 * into a deterministic, reproducible byte string for hashing.
 *
 * Rules:
 * - Only pseudonymous fields are included (no names, phone numbers, raw account numbers)
 * - Fields are sorted alphabetically
 * - All values are cast to strings and lowercased where appropriate
 * - Fields are joined as "key=value|key=value|..."
 *
 * This exact same logic must be used in:
 *   1. The API gateway when computing the leaf commitment
 *   2. The reconciliation engine when recomputing from DB rows
 *   3. The Flutter app when re-deriving the leaf from a QR payload
 *
 * Any deviation will produce a different leaf and trigger a MODIFIED alert.
 */

const CANONICAL_FIELDS = [
  'acct_pseudo',
  'amount',
  'sequence_no',
  'tenant_id',
  'tx_ref',
  'tx_timestamp',
  'tx_type',
];

/**
 * Canonicalise a transaction payload.
 * @param {object} tx - transaction fields
 * @returns {string} - canonical string representation
 */
function canonicalise(tx) {
  return CANONICAL_FIELDS
    .map(key => {
      const val = tx[key];
      if (val === undefined || val === null) {
        throw new Error(`Missing required canonical field: ${key}`);
      }
      return `${key}=${String(val)}`;
    })
    .join('|');
}

/**
 * Validate that all required canonical fields are present.
 * @param {object} tx
 * @returns {string[]} list of missing fields (empty if all present)
 */
function missingFields(tx) {
  return CANONICAL_FIELDS.filter(k => tx[k] === undefined || tx[k] === null);
}

module.exports = { canonicalise, missingFields, CANONICAL_FIELDS };
