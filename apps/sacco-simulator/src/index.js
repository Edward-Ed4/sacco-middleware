'use strict';

/**
 * Simulated SACCO Core-Banking System
 *
 * This simulates what a real SACCO system (MOBIS, Saccowave, SaccoSys)
 * would do — it records transactions and calls the middleware commit
 * endpoint after each one.
 *
 * Used for:
 *   1. Development and testing without a real SACCO system
 *   2. Panel/demo presentations to show the full flow end-to-end
 *   3. Generating test data for the reconciliation engine
 *
 * Endpoints:
 *   POST /simulator/transaction  - record a new transaction
 *   POST /simulator/tamper/:id   - simulate an insider modifying a record
 *   POST /simulator/delete/:id   - simulate an insider deleting a record
 *   GET  /simulator/transactions - list all recorded transactions
 *   GET  /simulator/health       - health check
 */

require('dotenv').config();
const express  = require('express');
const crypto   = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const { SaccoAdapter } = require('@sacco/shared');
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = process.env.SACCO_API_KEY ? new SaccoAdapter({
  gatewayUrl:  process.env.GATEWAY_URL  || 'http://localhost:3000',
  apiKey:      process.env.SACCO_API_KEY,
  hmacKeyHex:  process.env.SACCO_HMAC_KEY,
}) : null;

const app = express();
app.use(express.json());

// In-memory transaction store (simulates the SACCO database)
const transactions = new Map();
let sequenceNo = 1;

const TX_TYPES = ['deposit', 'withdrawal', 'loan', 'repayment'];

/**
 * POST /simulator/transaction
 * Record a new transaction and commit it to the middleware.
 */
app.post('/simulator/transaction', async (req, res) => {
  const {
    memberName    = 'Test Member',
    accountNumber = 'ACC-' + Math.floor(Math.random() * 9000 + 1000),
    txType        = TX_TYPES[Math.floor(Math.random() * TX_TYPES.length)],
    amount        = Math.floor(Math.random() * 500000 + 10000),
    phoneNumber,
  } = req.body;

  const txRef       = `TXN-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;
  const txTimestamp = new Date().toISOString();
  const acctPseudo  = adapter
    ? adapter.pseudonymise(accountNumber)
    : crypto.createHash('sha256').update(accountNumber).digest('hex');

  // Save to "SACCO database" (in-memory)
  const record = {
    id:           uuidv4(),
    txRef,
    memberName,
    accountNumber,
    acctPseudo,
    txType,
    amount,
    txTimestamp,
    sequenceNo:   sequenceNo++,
    phoneNumber,
    receiptId:    null,
    verificationCode: null,
  };
  transactions.set(record.id, record);

  logger.info('Transaction recorded in SACCO DB', { txRef, txType, amount });

  // Commit to middleware (if configured)
  let middlewareResult = null;
  if (adapter) {
    try {
      middlewareResult = await adapter.commit({
        txRef,
        txType,
        amount,
        acctPseudo,
        txTimestamp,
        sequenceNo: record.sequenceNo,
        phoneNumber,
      });
      record.receiptId        = middlewareResult.receiptId;
      record.verificationCode = middlewareResult.verificationCode;
      logger.info('Committed to middleware', { receiptId: middlewareResult.receiptId });
    } catch (err) {
      logger.error('Middleware commit failed', { err: err.message });
    }
  } else {
    logger.warn('No SACCO_API_KEY set — skipping middleware commit (set env vars to enable)');
  }

  res.status(201).json({
    id:               record.id,
    txRef,
    txType,
    amount,
    txTimestamp,
    receiptId:        record.receiptId,
    verificationCode: record.verificationCode,
    middleware:       middlewareResult ? 'committed' : 'skipped (no API key)',
  });
});

/**
 * POST /simulator/tamper/:id
 * Simulate an insider modifying a transaction amount (T1 in threat model).
 */
app.post('/simulator/tamper/:id', (req, res) => {
  const record = transactions.get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Transaction not found' });

  const originalAmount = record.amount;
  record.amount = req.body.newAmount || record.amount * 0.5;
  logger.warn('TAMPER SIMULATED', {
    id: req.params.id,
    txRef: record.txRef,
    original: originalAmount,
    tampered: record.amount,
  });

  res.json({
    warning:  'Transaction tampered — reconciliation engine should detect MODIFIED',
    id:       req.params.id,
    txRef:    record.txRef,
    original: originalAmount,
    tampered: record.amount,
  });
});

/**
 * POST /simulator/delete/:id
 * Simulate an insider deleting a transaction (T2 in threat model).
 */
app.post('/simulator/delete/:id', (req, res) => {
  const record = transactions.get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Transaction not found' });

  transactions.delete(req.params.id);
  logger.warn('DELETE SIMULATED', { id: req.params.id, txRef: record.txRef });

  res.json({
    warning: 'Transaction deleted — reconciliation engine should detect DELETED or UNANCHORED',
    id:      req.params.id,
    txRef:   record.txRef,
  });
});

/**
 * GET /simulator/transactions
 * List all transactions in the simulated SACCO database.
 */
app.get('/simulator/transactions', (req, res) => {
  res.json(Array.from(transactions.values()));
});

app.get('/simulator/health', (req, res) => {
  res.json({ status: 'ok', transactions: transactions.size, nextSeq: sequenceNo });
});

const PORT = process.env.SIMULATOR_PORT || 3004;
app.listen(PORT, () => {
  logger.info(`SACCO Simulator running on port ${PORT}`);
  logger.info('Use POST /simulator/transaction to generate test transactions');
  logger.info('Use POST /simulator/tamper/:id to simulate insider tampering');
});
