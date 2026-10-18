'use strict';

const { Pool } = require('pg');
const logger   = require('./logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max:              10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('PostgreSQL pool error', { err: err.message });
});

/**
 * Execute a parameterised query.
 * @param {string} text   - SQL
 * @param {Array}  params - bind parameters
 */
async function query(text, params) {
  const start = Date.now();
  const res   = await pool.query(text, params);
  logger.debug('DB query', { text: text.substring(0, 80), duration: Date.now() - start, rows: res.rowCount });
  return res;
}

/**
 * Get a client for multi-statement transactions.
 */
async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
