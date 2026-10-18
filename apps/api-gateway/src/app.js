'use strict';

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');

const commitRouter  = require('./routes/commit');
const verifyRouter  = require('./routes/verify');
const tenantRouter  = require('./routes/tenant');
const healthRouter  = require('./routes/health');
const errorHandler  = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

const app = express();

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50kb' }));

// ── Request logging ──────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Global rate limiter (100 req/s per IP) ───────────────────────────────────
app.use(rateLimit({
  windowMs: 1000,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests' },
}));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/health',       healthRouter);
app.use('/v1/commit',    commitRouter);
app.use('/v1/verify',    verifyRouter);
app.use('/v1/tenants',   tenantRouter);

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
