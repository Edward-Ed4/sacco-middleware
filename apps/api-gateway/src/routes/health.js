'use strict';

const express  = require('express');
const { pool } = require('../utils/db');
const { redis } = require('../utils/redis');

const router = express.Router();

/**
 * GET /health
 * Detailed health check — checks PostgreSQL and Redis connectivity.
 * Returns 200 if all dependencies are healthy, 503 if any are degraded.
 */
router.get('/', async (req, res) => {
  const checks  = {};
  const details = {};
  const start   = Date.now();

  // PostgreSQL check
  try {
    const t0 = Date.now();
    await pool.query('SELECT 1');
    checks.postgres  = 'ok';
    details.postgres = { latencyMs: Date.now() - t0 };
  } catch (err) {
    checks.postgres  = 'error';
    details.postgres = { error: err.message };
  }

  // Redis check
  try {
    const t0 = Date.now();
    await redis.ping();
    checks.redis  = 'ok';
    details.redis = { latencyMs: Date.now() - t0 };
  } catch (err) {
    checks.redis  = 'error';
    details.redis = { error: err.message };
  }

  const healthy = Object.values(checks).every(v => v === 'ok');

  res.status(healthy ? 200 : 503).json({
    status:      healthy ? 'healthy' : 'degraded',
    checks,
    details,
    version:     '1.0.0',
    uptime:      process.uptime(),
    totalMs:     Date.now() - start,
    ts:          new Date().toISOString(),
  });
});

/**
 * GET /health/ready
 * Kubernetes/Docker readiness probe — lightweight, no DB check.
 */
router.get('/ready', (req, res) => {
  res.json({ ready: true });
});

module.exports = router;
