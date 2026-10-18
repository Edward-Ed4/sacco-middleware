'use strict';

require('dotenv').config();
const { startWorker } = require('./worker');
const logger = require('./logger');

logger.info('Anchor worker starting...');
startWorker().catch((err) => {
  logger.error('Anchor worker fatal error', { err: err.message });
  process.exit(1);
});
