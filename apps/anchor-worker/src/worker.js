'use strict';

const Redis    = require('ioredis');
const { Pool } = require('pg');
const { ethers } = require('ethers');
const { v4: uuidv4 } = require('uuid');
const { buildBatch, uuidToBytes32 } = require('./batchBuilder');
const logger   = require('./logger');

const STREAM         = 'sacco:anchor:queue';
const CONSUMER_GROUP = 'anchor-workers';
const CONSUMER_NAME  = 'worker-1';
const BATCH_SIZE     = Number(process.env.ANCHOR_BATCH_SIZE)      || 50;
const INTERVAL_MS    = Number(process.env.ANCHOR_INTERVAL_SECONDS || 15) * 1000;

const ANCHOR_ABI = [
  'function anchor(bytes32 batchId, bytes32 merkleRoot, uint64 seqStart, uint64 seqEnd) external',
  'event BatchAnchored(bytes32 indexed batchId, bytes32 indexed merkleRoot, uint64 seqStart, uint64 seqEnd, address submitter)',
];

async function startWorker() {
  // Start health check server
  require('./healthcheck');

  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const pool  = new Pool({ connectionString: process.env.DATABASE_URL });

  // Ensure consumer group exists
  try {
    await redis.xgroup('CREATE', STREAM, CONSUMER_GROUP, '$', 'MKSTREAM');
    logger.info('Consumer group created', { group: CONSUMER_GROUP });
  } catch (err) {
    if (!err.message.includes('BUSYGROUP')) throw err;
    logger.info('Consumer group already exists');
  }

  // Set up ethers provider + signer
  let contract = null;
  if (process.env.ANCHOR_CONTRACT_ADDRESS && process.env.DEPLOYER_PRIVATE_KEY) {
    const provider = new ethers.JsonRpcProvider(process.env.BESU_RPC_URL || 'http://localhost:8545');
    const wallet   = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    contract = new ethers.Contract(process.env.ANCHOR_CONTRACT_ADDRESS, ANCHOR_ABI, wallet);
    logger.info('AnchorRegistry contract loaded', { address: process.env.ANCHOR_CONTRACT_ADDRESS });
  } else {
    logger.warn('Running in DRY-RUN mode — blockchain anchoring disabled');
  }

  logger.info('Anchor worker ready', { stream: STREAM, batchSize: BATCH_SIZE, intervalMs: INTERVAL_MS });

  while (true) {
    try {
      await processBatch(redis, pool, contract);
    } catch (err) {
      logger.error('Batch processing error', { err: err.message });
    }
    await sleep(INTERVAL_MS);
  }
}

async function processBatch(redis, pool, contract) {
  const results = await redis.xreadgroup(
    'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
    'COUNT', BATCH_SIZE,
    'BLOCK', 1000,
    'STREAMS', STREAM, '>'
  );

  if (!results || !results.length) return;

  const [, messages] = results[0];
  if (!messages || !messages.length) return;

  logger.info(`Processing batch of ${messages.length} commitments`);

  // Parse stream messages
  const items = messages.map(([streamId, fields]) => {
    const obj = {};
    for (let i = 0; i < fields.length; i += 2) obj[fields[i]] = fields[i + 1];
    return { streamId, ...obj };
  });

  // Build Merkle tree using the batch builder
  const batch    = buildBatch(items);
  const batchId  = uuidv4();
  const seqStart = Math.min(...items.map(it => Number(it.sequenceNo)));
  const seqEnd   = Math.max(...items.map(it => Number(it.sequenceNo)));

  logger.info('Merkle tree built', {
    batchId,
    rootHex:  batch.rootHex.substring(0, 16) + '...',
    count:    batch.count,
    seqStart, seqEnd,
  });

  // Anchor on blockchain
  let txHash = null;
  let blockNumber = 0;

  if (contract) {
    try {
      const batchIdBytes32 = uuidToBytes32(batchId);
      const rootBytes32    = '0x' + batch.rootHex;
      const tx = await contract.anchor(batchIdBytes32, rootBytes32, seqStart, seqEnd);
      const receipt = await tx.wait();
      txHash      = receipt.hash;
      blockNumber = receipt.blockNumber;
      logger.info('Batch anchored on chain', { txHash, blockNumber });
    } catch (err) {
      logger.error('Blockchain anchor failed — will retry', { err: err.message });
      return; // Don't ACK — retry on next cycle
    }
  } else {
    txHash      = '0x' + Buffer.alloc(32, 0).toString('hex');
    blockNumber = 0;
    logger.info('DRY-RUN: anchor simulated', { batchId });
  }

  // Update DB
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO anchor_batches (id, tenant_id, merkle_root, seq_start, seq_end, tx_hash, block_number, anchored_at)
       VALUES ($1,
         (SELECT tenant_id FROM commitments WHERE receipt_id = $2 LIMIT 1),
         $3, $4, $5, $6, $7, NOW())`,
      [batchId, items[0].receiptId, batch.rootHex, seqStart, seqEnd, txHash, blockNumber]
    );

    for (let i = 0; i < items.length; i++) {
      await client.query(
        `UPDATE commitments
         SET status = 'ANCHORED', batch_id = $1, merkle_proof = $2, block_number = $3
         WHERE receipt_id = $4`,
        [batchId, JSON.stringify(batch.proofs[i].proof), blockNumber, items[i].receiptId]
      );
    }

    await client.query('COMMIT');
    logger.info('DB updated', { batchId, count: items.length });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('DB update failed', { err: err.message });
    throw err;
  } finally {
    client.release();
  }

  // ACK messages
  const streamIds = messages.map(([id]) => id);
  await redis.xack(STREAM, CONSUMER_GROUP, ...streamIds);
  logger.info('Stream messages ACKed', { count: streamIds.length });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { startWorker };
