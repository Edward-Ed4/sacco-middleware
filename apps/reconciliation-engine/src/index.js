'use strict';

require('dotenv').config();
const cron   = require('node-cron');
const logger = require('./logger');
const { runReconciliation } = require('./reconciler');
const { sendAlerts }        = require('./alertService');

const CRON = process.env.RECONCILE_CRON || '*/5 * * * *'; // every 5 minutes

logger.info('Reconciliation engine starting', { schedule: CRON });

// Run once immediately on startup
runReconciliation()
  .then(() => sendAlerts())
  .catch(err => logger.error('Initial reconciliation failed', { err: err.message }));

// Then on schedule
cron.schedule(CRON, async () => {
  logger.info('Reconciliation cycle starting');
  try {
    await runReconciliation();
    await sendAlerts();
  } catch (err) {
    logger.error('Reconciliation cycle failed', { err: err.message });
  }
});
