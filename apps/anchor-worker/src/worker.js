'use strict';

const Redis   = require('ioredis');
const { Pool } = require('pg');
const { ethers } = require('ethers');
const { v4: uuidv4 } = require('uuid');
const { buildTree, generateProof } = require('@sacco/shared');
const logger  = require('./logger');

const STREAM         = 'sacco:anchor:queue';
const CONSUMER_GROUP = 'anchor-workers';
const CONSUMER_NAME  = 'worker-1';
const BATCH_SIZE     = Number(process.env.ANCHOR_BATCH_SIZE)     || 50;
const INTERVAL_MS    = Number(process.env.ANCHOR_INTERVAL_SECONDS || 15) * 1000;

// AnchorRegistry ABI — only the functions we need
const ANCHOR_ABI = [
  'function anchor(bytes32 batchId, bytes32 merkleRoot, uint64 seqStart, uint64 seqEnd) external',
  'event BatchAnchored(bytes32 indexed batchId, bytes32 indexed merkleRoot, uint64 seqStart, uint64 seqEnd, address submitter)',
];

async function startWorker() {
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
  const provider = new ethers.JsonRpcProvider(process.env.BESU_RPC_URL || 'http://localhost:8545');
  let contract   = null;

  if (process.env.ANCHOR_CONTRACT_ADDRESS && process.env.DEPLOYER_PRIVATE_KEY) {
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    contract = new ethers.Contract(process.env.ANCHOR_CONTRACT_ADDRESS, ANCHOR_ABI, wallet);
    logger.info('AnchorRegistry contract loaded', { address: process.env.ANCHOR_CONTRACT_ADDRESS });
  } else {
    logger.warn('ANCHOR_CONTRACT_ADDRESS or DEPLOYER_PRIVATE_KEY not set — running in dry-run mode');
  }

  logger.info('Anchor worker ready. Polling stream...', { stream: STREAM, batchSize: BATCH_SIZE, intervalMs: INTERVAL_MS });

  // Main loop
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
  // Read up to BATCH_SIZE messages from the stream
  const results = await redis.xreadgroup(
    'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
    'COUNT', BATCH_SIZE,
    'BLOCK', 1000,
    'STREAMS', STREAM, '>'
  );

  if (!results || results.length === 0) return;

  const [, messages] = results[0];
  if (!messages || messages.length === 0) return;

  logger.info(`Processing batch of ${messages.length} commitments`);

  // Parse messages
  const items = messages.map(([streamId, fields]) => {
    const obj = {};
    for (let i = 0; i < fields.length; i += 2) obj[fields[i]] = fields[i + 1];
    return { streamId, ...obj };
  });

  // Build Merkle tree from leaf hashes
  const leaves   = items.map(it => Buffer.from(it.leafHex, 'hex'));
  const { root, layers } = buildTree(leaves);
  const rootHex  = root.toString('hex');

  const batchId  = uuidv4();
  const seqStart = Math.min(...items.map(it => Number(it.sequenceNo)));
  const seqEnd   = Math.max(...items.map(it => Number(it.sequenceNo)));

  logger.info('Merkle tree built', { batchId, rootHex: rootHex.substring(0, 16) + '...', seqStart, seqEnd });

  // Anchor on blockchain
  let txHash = null;
  let blockNumber = null;

  if (contract) {
    try {
      const batchIdBytes32 = '0x' + Buffer.from(batchId.replace(/-/g, ''), 'hex').toString('hex').padEnd(64, '0');
      const rootBytes32    = '0x' + rootHex;
      const tx = await contract.anchor(batchIdBytes32, rootBytes32, seqStart, seqEnd);
      const receipt = await tx.wait();
      txHash      = receipt.hash;
      blockNumber = receipt.blockNumber;
      logger.info('Batch anchored on chain', { txHash, blockNumber });
    } catch (err) {
      logger.error('Blockchain anchor failed', { err: err.message });
      // Don't ACK — will retry on next cycle
      return;
    }
  } else {
    // Dry-run: simulate anchoring
    txHash      = '0x' + Buffer.alloc(32).toString('hex');
    blockNumber = 0;
    logger.info('DRY-RUN: simulated anchor', { batchId });
  }

  // Persist batch and update commitments in DB
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO anchor_batches (id, tenant_id, merkle_root, seq_start, seq_end, tx_hash, block_number, anchored_at)
       VALUES ($1,
         (SELECT tenant_id FROM commitments WHERE receipt_id = $2 LIMIT 1),
         $3, $4, $5, $6, $7, NOW())`,
      [batchId, items[0].receiptId, rootHex, seqStart, seqEnd, txHash, blockNumber]
    );

    // Update each commitment with proof, batch reference, block number
    for (let i = 0; i < items.length; i++) {
      const proof = generateProof(layers, i);
      await client.query(
        `UPDATE commitments
         SET status = 'ANCHORED',
             batch_id = $1,
             merkle_proof = $2,
             block_number = $3
         WHERE receipt_id = $4`,
        [batchId, JSON.stringify(proof), blockNumber, items[i].receiptId]
      );
    }

    await client.query('COMMIT');
    logger.info('DB updated for batch', { batchId, count: items.length });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('DB update failed', { err: err.message });
    throw err;
  } finally {
    client.release();
  }

  // ACK all messages
  const streamIds = messages.map(([id]) => id);
  await redis.xack(STREAM, CONSUMER_GROUP, ...streamIds);
  logger.info('Stream messages ACKed', { count: streamIds.length });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { startWorker };
