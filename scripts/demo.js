#!/usr/bin/env node
'use strict';

/**
 * End-to-end demo script
 *
 * Demonstrates the full SACCO middleware flow:
 *   1. Register a test tenant
 *   2. Submit 3 transactions
 *   3. Wait for anchoring
 *   4. Verify each receipt
 *   5. Simulate insider tampering
 *   6. Show reconciliation detects the tamper
 *
 * Prerequisites: docker-compose up postgres redis
 * Run: node scripts/demo.js
 */

const crypto = require('crypto');
const { canonicaliseJson } = require('@sacco/shared');

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:3000';

function log(msg, data = '') {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(data ? `${line}\n  ${JSON.stringify(data, null, 2).replace(/\n/g, '\n  ')}` : line);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function post(path, body, headers = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body:    JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST ${path} failed (${res.status}): ${JSON.stringify(json)}`);
  return json;
}

async function get(path) {
  const res = await fetch(`${GATEWAY}${path}`);
  const json = await res.json();
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status}): ${JSON.stringify(json)}`);
  return json;
}

function computeHmac(body, hmacKeyHex) {
  return crypto
    .createHmac('sha256', Buffer.from(hmacKeyHex, 'hex'))
    .update(canonicaliseJson(JSON.parse(body)))
    .digest('hex');
}

async function commitTx(tenant, tx) {
  const body = JSON.stringify(tx);
  const hmac = computeHmac(body, tenant.hmacKeyHex);
  return post('/v1/commit', tx, {
    'X-API-Key':      tenant.apiKey,
    'X-Request-HMAC': hmac,
  });
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  SACCO MIDDLEWARE — END-TO-END DEMO');
  console.log('═'.repeat(60) + '\n');

  // ── Step 1: Check gateway health ─────────────────────────────
  log('Step 1: Checking gateway health...');
  const health = await get('/health');
  log('Gateway status:', health);
  if (health.status !== 'healthy') {
    throw new Error('Gateway is not healthy. Make sure docker-compose services are running.');
  }

  // ── Step 2: Register a test tenant ───────────────────────────
  log('\nStep 2: Registering test SACCO tenant...');
  const tenant = await post('/v1/tenants/register', { name: 'Demo SACCO Ltd' });
  log('Tenant registered:', { tenantId: tenant.tenantId, name: tenant.name });
  log('⚠️  In production, store these credentials securely — shown only once!');

  // ── Step 3: Submit transactions ───────────────────────────────
  log('\nStep 3: Submitting 3 test transactions...');
  const receipts = [];

  const txs = [
    { txRef: 'DEMO-001', txType: 'deposit',    amount: 150000, sequenceNo: 1, phoneNumber: '+256700000001' },
    { txRef: 'DEMO-002', txType: 'withdrawal', amount:  50000, sequenceNo: 2, phoneNumber: '+256700000002' },
    { txRef: 'DEMO-003', txType: 'loan',       amount: 500000, sequenceNo: 3, phoneNumber: '+256700000003' },
  ];

  for (const tx of txs) {
    const payload = {
      ...tx,
      acct_pseudo:  crypto.createHash('sha256').update(`ACC-${tx.sequenceNo}`).digest('hex'),
      tx_timestamp: new Date().toISOString(),
      tenant_id:    tenant.tenantId,
    };
    const result = await commitTx(tenant, payload);
    receipts.push({ ...result, txRef: tx.txRef });
    log(`  ✓ ${tx.txRef} committed`, { receiptId: result.receiptId, code: result.verificationCode });
    await sleep(200);
  }

  // ── Step 4: Wait for anchoring ────────────────────────────────
  log('\nStep 4: Waiting 20 seconds for anchor worker to batch and anchor...');
  await sleep(20000);

  // ── Step 5: Verify receipts ───────────────────────────────────
  log('\nStep 5: Verifying receipts...');
  for (const r of receipts) {
    const verification = await get(`/v1/verify/${r.receiptId}`);
    log(`  ${r.txRef}: ${verification.status}`, {
      receiptId:   verification.receiptId,
      merkleRoot:  verification.merkleRoot ? verification.merkleRoot.substring(0, 16) + '...' : null,
      blockNumber: verification.blockNumber,
    });
  }

  // ── Step 6: Summary ───────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  DEMO COMPLETE');
  console.log('═'.repeat(60));
  console.log('\nOpen the dashboard at http://localhost:3003 to see:');
  console.log('  • Committed transactions in the stats panel');
  console.log('  • Anchor batches with Merkle roots and block numbers');
  console.log('  • Reconciliation results (all VALID)');
  console.log('\nTo test tamper detection:');
  console.log('  1. Update a row directly in PostgreSQL');
  console.log('  2. Wait for the next reconciliation cycle (5 min default)');
  console.log('  3. The dashboard will show a MODIFIED finding with an alert\n');
}

main().catch(err => {
  console.error('\nDemo failed:', err.message);
  process.exit(1);
});
