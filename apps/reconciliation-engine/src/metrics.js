'use strict';

/**
 * Simple in-memory metrics collector for the reconciliation engine.
 * Exposes a /metrics endpoint for Prometheus scraping.
 */

const http   = require('http');
const logger = require('./logger');

const counters = {
  reconciliation_runs_total:    0,
  findings_modified_total:      0,
  findings_deleted_total:       0,
  findings_unanchored_total:    0,
  alerts_sent_total:            0,
};

function increment(key, amount = 1) {
  if (key in counters) counters[key] += amount;
}

function getMetricsText() {
  return Object.entries(counters)
    .map(([k, v]) => `# TYPE ${k} counter\n${k} ${v}`)
    .join('\n') + '\n';
}

const PORT = process.env.METRICS_PORT || 9091;

const server = http.createServer((req, res) => {
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
    res.end(getMetricsText());
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'reconciliation-engine' }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  logger.info(`Metrics endpoint listening on port ${PORT}/metrics`);
});

module.exports = { increment, server };
