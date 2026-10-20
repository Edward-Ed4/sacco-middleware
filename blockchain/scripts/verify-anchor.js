'use strict';

/**
 * verify-anchor.js
 *
 * CLI utility to query the AnchorRegistry contract and verify that
 * a batch ID has been anchored on the Besu network.
 *
 * Usage:
 *   node blockchain/scripts/verify-anchor.js <batchId>
 *
 * Example:
 *   node blockchain/scripts/verify-anchor.js 0xabc123...
 */

require('dotenv').config();
const { ethers } = require('ethers');

const ANCHOR_ABI = [
  'function getRoot(bytes32 batchId) external view returns (bytes32)',
  'function getBatch(bytes32 batchId) external view returns (tuple(bytes32 merkleRoot, uint64 seqStart, uint64 seqEnd, uint64 timestamp, address submitter))',
  'function totalBatches() external view returns (uint256)',
];

async function main() {
  const batchId = process.argv[2];
  if (!batchId) {
    console.error('Usage: node verify-anchor.js <batchId-as-bytes32-hex>');
    process.exit(1);
  }

  const rpcUrl      = process.env.BESU_RPC_URL || 'http://localhost:8545';
  const contractAddr = process.env.ANCHOR_CONTRACT_ADDRESS;

  if (!contractAddr) {
    console.error('ANCHOR_CONTRACT_ADDRESS not set in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddr, ANCHOR_ABI, provider);

  console.log(`\nQuerying AnchorRegistry at ${contractAddr}`);
  console.log(`RPC: ${rpcUrl}`);
  console.log(`BatchId: ${batchId}\n`);

  const root  = await contract.getRoot(batchId);
  const batch = await contract.getBatch(batchId);
  const total = await contract.totalBatches();

  if (root === '0x' + '0'.repeat(64)) {
    console.log('❌ Batch NOT found on chain.');
  } else {
    console.log('✅ Batch anchored on chain:');
    console.log(`   Merkle Root : ${root}`);
    console.log(`   Seq Range   : ${batch.seqStart} → ${batch.seqEnd}`);
    console.log(`   Timestamp   : ${new Date(Number(batch.timestamp) * 1000).toISOString()}`);
    console.log(`   Submitter   : ${batch.submitter}`);
  }
  console.log(`\nTotal anchored batches: ${total}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
