'use strict';

/**
 * Request body validation middleware for the commit endpoint.
 * Validates field types, ranges and formats before they reach the service layer.
 */

const VALID_TX_TYPES = ['deposit', 'withdrawal', 'loan', 'repayment', 'transfer'];

function validateCommit(req, res, next) {
  const { tx_ref, tx_type, amount, acct_pseudo, tx_timestamp, sequence_no } = req.body;
  const errors = [];

  if (!tx_ref || typeof tx_ref !== 'string' || tx_ref.trim().length === 0) {
    errors.push('tx_ref is required and must be a non-empty string');
  }

  if (!tx_type || !VALID_TX_TYPES.includes(tx_type)) {
    errors.push(`tx_type must be one of: ${VALID_TX_TYPES.join(', ')}`);
  }

  if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) {
    errors.push('amount must be a positive number');
  }

  if (!acct_pseudo || typeof acct_pseudo !== 'string' || acct_pseudo.trim().length === 0) {
    errors.push('acct_pseudo is required');
  }

  if (!tx_timestamp || isNaN(Date.parse(tx_timestamp))) {
    errors.push('tx_timestamp must be a valid ISO 8601 date string');
  }

  if (sequence_no == null || isNaN(Number(sequence_no)) || Number(sequence_no) < 1) {
    errors.push('sequence_no must be a positive integer');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  // Normalise types
  req.body.tx_ref      = String(tx_ref).trim();
  req.body.tx_type     = String(tx_type).trim().toLowerCase();
  req.body.amount      = Number(amount);
  req.body.acct_pseudo = String(acct_pseudo).trim();
  req.body.sequence_no = Number(sequence_no);

  next();
}

module.exports = { validateCommit };
