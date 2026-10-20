'use strict';

const express  = require('express');
const { query } = require('../utils/db');
const { registerTenant, deactivateTenant, getTenantStats } = require('../services/tenantService');

const router = express.Router();

/**
 * POST /v1/tenants/register
 * Register a new SACCO tenant. Returns credentials ONCE — store them securely.
 */
router.post('/register', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }
    const credentials = await registerTenant(name.trim());
    res.status(201).json({
      ...credentials,
      warning: 'Store these credentials securely. They will not be shown again.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/tenants/:id
 * Get public tenant info (no secrets).
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, name, active, created_at FROM tenants WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/tenants/:id/stats
 * Get commitment statistics for a tenant.
 */
router.get('/:id/stats', async (req, res, next) => {
  try {
    const stats = await getTenantStats(req.params.id);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /v1/tenants/:id
 * Deactivate a tenant (soft delete).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await deactivateTenant(req.params.id);
    res.json({ message: 'Tenant deactivated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
