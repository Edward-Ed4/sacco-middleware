'use strict';

/**
 * Simple HTTP health check endpoint for the anchor worker.
 * Docker / orchestration tools ping this to know if the worker is alive.
 */

const http = require('http');
const logger = require('./logger');

const PORT = process.env.ANCHOR_HEALTH_PORT || 3001;

const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'anchor-worker', ts: new Date().toISOString() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  logger.info(`Anchor worker health check listening on port ${PORT}`);
});

module.exports = server;
