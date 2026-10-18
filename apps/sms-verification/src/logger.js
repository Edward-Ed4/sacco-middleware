'use strict';
const { createLogger, format, transports } = require('winston');
module.exports = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});
