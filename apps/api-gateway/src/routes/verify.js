'use strict';

const express  = require('express');
const { query } = require('../utils/db');
const { verifyProof } = require('@sacco/shared');

const router = express.Router();

/**
 * GET /v1/verify/:receiptId
 *
 * Returns commitment status + Merkle proof for the Flutter app.
 * The app independently checks the proof against the on-chain root.
 */
router.get('/:receiptId', async (req, res, next) => {
  try {
    const { receiptId } = req.params;

    const { rows } = await query(
      `SELECT c.receipt_id, c.tenant_id, c.tx_ref, c.tx_type,
              c.amount, c.acct_pseudo, c.tx_timestamp, c.sequence_no,
              c.leaf_hex, c.chain_hex, c.status,
              c.merkle_proof, c.batch_id, c.block_number,
              b.merkle_root, b.tx_hash
       FROM commitments c
       LEFT JOIN anchor_batches b ON c.batch_id = b.id
       WHERE c.receipt_id = $1`,
      [receiptId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const row = rows[0];

    res.json({
      receiptId:    row.receipt_id,
      tenantId:     row.tenant_id,
      txRef:        row.tx_ref,
      txType:       row.tx_type,
      amount:       row.amount,
      acctPseudo:   row.acct_pseudo,
      txTimestamp:  row.tx_timestamp,
      sequenceNo:   row.sequence_no,
      leafHex:      row.leaf_hex,
      status:       row.status,
      merkleProof:  row.merkle_proof  || null,
      merkleRoot:   row.merkle_root   || null,
      batchId:      row.batch_id      || null,
      blockNumber:  row.block_number  || null,
      txHash:       row.tx_hash       || null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/verify/proof
 *
 * Body: { leafHex, proof, rootHex }
 * Quick server-side proof check (client should also check independently).
 */
router.post('/proof', (req, res) => {
  const { leafHex, proof, rootHex } = req.body;
  if (!leafHex || !proof || !rootHex) {
    return res.status(400).json({ error: 'leafHex, proof and rootHex are required' });
  }
  try {
    const valid = verifyProof(leafHex, proof, rootHex);
    res.json({ valid });
  } catch (err) {
    res.status(400).json({ error: 'Invalid proof format' });
  }
});

module.exports = router;
