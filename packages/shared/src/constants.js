'use strict';

/**
 * Shared constants used across all SACCO middleware services.
 */

// Transaction types accepted by the system
const TX_TYPES = Object.freeze(['deposit', 'withdrawal', 'loan', 'repayment', 'transfer']);

// Commitment statuses
const COMMITMENT_STATUS = Object.freeze({
  PENDING:   'PENDING',
  ANCHORED:  'ANCHORED',
});

// Reconciliation finding types
const FINDING_TYPES = Object.freeze({
  VALID:       'VALID',
  MODIFIED:    'MODIFIED',
  DELETED:     'DELETED',
  UNANCHORED:  'UNANCHORED',
});

// Alert channels
const ALERT_CHANNELS = Object.freeze(['sms', 'email', 'dashboard']);

// Redis stream name for anchor queue
const ANCHOR_STREAM = 'sacco:anchor:queue';

// Maximum SMS code attempts before lockout
const MAX_SMS_ATTEMPTS = 3;

// Lockout duration in milliseconds (15 minutes)
const SMS_LOCKOUT_MS = 15 * 60 * 1000;

// How long a commitment can stay PENDING before flagged as UNANCHORED (10 minutes)
const UNANCHORED_THRESHOLD_MS = 10 * 60 * 1000;

module.exports = {
  TX_TYPES,
  COMMITMENT_STATUS,
  FINDING_TYPES,
  ALERT_CHANNELS,
  ANCHOR_STREAM,
  MAX_SMS_ATTEMPTS,
  SMS_LOCKOUT_MS,
  UNANCHORED_THRESHOLD_MS,
};
