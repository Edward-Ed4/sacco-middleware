'use strict';

const express = require('express');
const { pool } = require('../utils/db');
const { redis } = require('../utils/redis');

const router = express.Router();

router.get('/', async (req, res) => {
  const checks = { postgres: 'ok', redis: 'ok' };

  try { await pool.query('SELECT 1'); } catch { checks.postgres = 'error'; }
  try { await redis.ping(); } catch { checks.redis = 'error'; }

  const healthy = Object.values(checks).every(v => v === 'ok');
  res.status(healthy ? 200 : 503).json({
    status:  healthy ? 'healthy' : 'degraded',
    checks,
    version: '1.0.0',
    ts:      new Date().toISOString(),
  });
});

module.exports = router;
