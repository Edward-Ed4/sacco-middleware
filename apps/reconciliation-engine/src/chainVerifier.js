'use strict';

const { Pool }   = require('pg');
const { verifyChain } = require('@sacco/shared');
const logger = require('./logger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Verify hash chain integrity for all tenants.
 *
 * The hash chain links every commitment sequentially — any deletion or
 * reordering will break the chain. This check runs alongside leaf
 * recomputation to catch a broader class of insider tampering.
 *
 * @returns {Array<{ tenantId, brokenAt }>} list of chain breaks found
 */
async function verifyAllChains() {
  const client = await pool.connect();
  const breaks = [];

  try {
    const { rows: tenants } = await client.query(
      'SELECT id FROM tenants WHERE active = TRUE'
    );

    for (const tenant of tenants) {
      const { rows: commitments } = await client.query(
        `SELECT leaf_hex, chain_hex, sequence_no
         FROM commitments
         WHERE tenant_id = $1
         ORDER BY sequence_no ASC`,
        [tenant.id]
      );

      if (commitments.length === 0) continue;

      const result = verifyChain(
        commitments.map(c => ({
          leafHex:    c.leaf_hex,
          chainHex:   c.chain_hex,
          sequenceNo: Number(c.sequence_no),
        }))
      );

      if (!result.valid) {
        logger.warn('Hash chain break detected', {
          tenantId: tenant.id,
          firstBrokenAt: result.firstBrokenAt,
        });
        breaks.push({ tenantId: tenant.id, brokenAt: result.firstBrokenAt });
      } else {
        logger.info('Hash chain intact', {
          tenantId: tenant.id,
          count: commitments.length,
        });
      }
    }
  } finally {
    client.release();
  }

  return breaks;
}

module.exports = { verifyAllChains };
