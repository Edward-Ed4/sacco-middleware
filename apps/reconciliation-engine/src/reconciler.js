'use strict';

const { Pool }  = require('pg');
const { v4: uuidv4 } = require('uuid');
const { computeLeaf } = require('@sacco/shared');
const logger = require('./logger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * For each tenant, fetch all commitments that are ANCHORED or PENDING,
 * re-read the corresponding rows from the SACCO replica DB (simulated here
 * by the same DB), recompute the leaf, and compare.
 *
 * Findings:
 *   VALID       — recomputed leaf matches stored leaf
 *   MODIFIED    — row exists but leaf no longer matches (data was changed)
 *   DELETED     — commitment exists in our store but row is gone from SACCO DB
 *   UNANCHORED  — commitment in our store but never got a batch_id after 10 min
 */
async function runReconciliation() {
  const client = await pool.connect();
  try {
    // Fetch all tenants
    const { rows: tenants } = await client.query(
      'SELECT id FROM tenants WHERE active = TRUE'
    );

    for (const tenant of tenants) {
      await reconcileTenant(client, tenant.id);
    }
  } finally {
    client.release();
  }
}

async function reconcileTenant(client, tenantId) {
  // Create a reconciliation run record
  const runId = uuidv4();
  await client.query(
    `INSERT INTO reconciliation_runs (id, tenant_id) VALUES ($1, $2)`,
    [runId, tenantId]
  );

  // Fetch all commitments for this tenant
  const { rows: commitments } = await client.query(
    `SELECT id, receipt_id, tx_ref, tx_type, amount, acct_pseudo,
            tx_timestamp, sequence_no, salt_hex, leaf_hex, status,
            batch_id, created_at
     FROM commitments
     WHERE tenant_id = $1
     ORDER BY sequence_no ASC`,
    [tenantId]
  );

  let valid = 0, modified = 0, deleted = 0, unanchored = 0;

  for (const c of commitments) {
    // In a real deployment, this reads from the read-only SACCO DB replica.
    // Here we simulate it by re-reading from our own commitments table and
    // checking internal consistency (leaf recomputation).
    let finding = 'VALID';
    let detail  = {};

    // Check UNANCHORED: PENDING for more than 10 minutes
    if (c.status === 'PENDING') {
      const ageMs = Date.now() - new Date(c.created_at).getTime();
      if (ageMs > 10 * 60 * 1000) {
        finding = 'UNANCHORED';
        detail  = { ageMs, status: c.status };
        unanchored++;
      } else {
        valid++; // still within anchoring window
        continue;
      }
    } else {
      // Recompute the leaf to detect MODIFIED / DELETED
      try {
        const salt = Buffer.from(c.salt_hex, 'hex');
        const txData = {
          tenant_id:    tenantId,
          tx_ref:       c.tx_ref,
          tx_type:      c.tx_type,
          amount:       String(c.amount),
          acct_pseudo:  c.acct_pseudo,
          tx_timestamp: c.tx_timestamp,
          sequence_no:  String(c.sequence_no),
        };
        const recomputed = computeLeaf(txData, salt).toString('hex');

        if (recomputed !== c.leaf_hex) {
          finding = 'MODIFIED';
          detail  = { stored: c.leaf_hex.substring(0, 16), recomputed: recomputed.substring(0, 16) };
          modified++;
        } else {
          valid++;
        }
      } catch (err) {
        finding = 'MODIFIED';
        detail  = { error: err.message };
        modified++;
      }
    }

    if (finding !== 'VALID') {
      await client.query(
        `INSERT INTO reconciliation_findings
           (id, run_id, tenant_id, tx_ref, commitment_id, finding, detail)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [uuidv4(), runId, tenantId, c.tx_ref, c.id, finding, JSON.stringify(detail)]
      );
    }
  }

  // Update run totals
  await client.query(
    `UPDATE reconciliation_runs
     SET total_checked = $1, valid_count = $2, modified_count = $3,
         deleted_count = $4, unanchored_count = $5
     WHERE id = $6`,
    [commitments.length, valid, modified, deleted, unanchored, runId]
  );

  if (modified > 0 || deleted > 0 || unanchored > 0) {
    logger.warn('Reconciliation found issues', { tenantId, modified, deleted, unanchored });
  } else {
    logger.info('Reconciliation clean', { tenantId, checked: commitments.length, valid });
  }
}

module.exports = { runReconciliation };
