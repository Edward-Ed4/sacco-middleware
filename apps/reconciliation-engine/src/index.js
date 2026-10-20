'use strict';

require('dotenv').config();
const cron   = require('node-cron');
const logger = require('./logger');
const { runReconciliation } = require('./reconciler');
const { sendAlerts }        = require('./alertService');
const { verifyAllChains }   = require('./chainVerifier');
const { increment }         = require('./metrics');

const CRON = process.env.RECONCILE_CRON || '*/5 * * * *';

logger.info('Reconciliation engine starting', { schedule: CRON });

async function runFullCycle() {
  logger.info('Reconciliation cycle starting');
  try {
    // Run leaf-level reconciliation
    await runReconciliation();
    increment('reconciliation_runs_total');

    // Run hash chain integrity check
    const chainBreaks = await verifyAllChains();
    if (chainBreaks.length > 0) {
      logger.warn('Hash chain breaks found', { count: chainBreaks.length, breaks: chainBreaks });
      increment('findings_deleted_total', chainBreaks.length);
    }

    // Dispatch alerts for any findings
    await sendAlerts();

    logger.info('Reconciliation cycle complete');
  } catch (err) {
    logger.error('Reconciliation cycle failed', { err: err.message });
  }
}

// Run once immediately on startup
runFullCycle();

// Then on schedule
cron.schedule(CRON, runFullCycle);
