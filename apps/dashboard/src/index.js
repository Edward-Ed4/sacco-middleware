'use strict';

require('dotenv').config();
const express = require('express');
const helmet  = require('helmet');
const path    = require('path');
const { Pool } = require('pg');
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app  = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API: Summary stats ───────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const [commits, batches, findings, alerts] = await Promise.all([
      pool.query(`SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE status='ANCHORED')         AS anchored,
        COUNT(*) FILTER (WHERE status='PENDING')          AS pending
        FROM commitments`),
      pool.query(`SELECT COUNT(*) AS total FROM anchor_batches`),
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE finding='MODIFIED')        AS modified,
        COUNT(*) FILTER (WHERE finding='DELETED')         AS deleted,
        COUNT(*) FILTER (WHERE finding='UNANCHORED')      AS unanchored
        FROM reconciliation_findings`),
      pool.query(`SELECT COUNT(*) FILTER (WHERE status='PENDING') AS pending_alerts FROM alerts`),
    ]);

    res.json({
      commitments: commits.rows[0],
      batches:     batches.rows[0],
      findings:    findings.rows[0],
      alerts:      alerts.rows[0],
    });
  } catch (err) {
    logger.error('Stats error', { err: err.message });
    res.status(500).json({ error: 'Database unavailable' });
  }
});

// ── API: Recent findings (MODIFIED / DELETED / UNANCHORED) ──────────────────
app.get('/api/findings', async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit  || 50), 200);
    const offset = Number(req.query.offset || 0);
    const { rows } = await pool.query(
      `SELECT f.id, f.tx_ref, f.finding, f.detail, f.alerted, f.created_at,
              t.name AS tenant_name
       FROM reconciliation_findings f
       JOIN tenants t ON t.id = f.tenant_id
       ORDER BY f.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: Recent anchor batches ───────────────────────────────────────────────
app.get('/api/batches', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.merkle_root, b.seq_start, b.seq_end,
              b.tx_hash, b.block_number, b.anchored_at,
              t.name AS tenant_name
       FROM anchor_batches b
       JOIN tenants t ON t.id = b.tenant_id
       ORDER BY b.anchored_at DESC
       LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: Reconciliation run history ─────────────────────────────────────────
app.get('/api/reconciliation', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.run_at, r.total_checked,
              r.valid_count, r.modified_count, r.deleted_count, r.unanchored_count,
              t.name AS tenant_name
       FROM reconciliation_runs r
       JOIN tenants t ON t.id = r.tenant_id
       ORDER BY r.run_at DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: Recent alerts ───────────────────────────────────────────────────────
app.get('/api/alerts', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.channel, a.recipient, a.message, a.status, a.sent_at,
              t.name AS tenant_name
       FROM alerts a
       JOIN tenants t ON t.id = a.tenant_id
       ORDER BY a.created_at DESC
       LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: Tenants list ────────────────────────────────────────────────────────
app.get('/api/tenants', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, active, created_at FROM tenants ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve SPA for all other routes ──────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.DASHBOARD_PORT || 3003;
app.listen(PORT, () => logger.info(`Dashboard running on port ${PORT}`));
