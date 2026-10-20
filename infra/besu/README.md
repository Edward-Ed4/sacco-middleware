# Hyperledger Besu QBFT Network

## Overview

This directory contains configuration for a 4-validator private QBFT network plus one read-only RPC node. Each validator is intended to be hosted by a different independent institution to prevent any single party from rewriting anchored history.

| Node | Role | Institution |
|------|------|-------------|
| validator1 | QBFT Validator | UMRA (Regulator) |
| validator2 | QBFT Validator | MTIC (Ministry) |
| validator3 | QBFT Validator | SACCO Apex Union |
| validator4 | QBFT Validator | Independent Auditor |
| rpc-node   | Read-only RPC  | Public / App layer |

## How QBFT Works

QBFT (Quorum Byzantine Fault Tolerant) is a Byzantine fault-tolerant consensus algorithm with **immediate finality** — once a block is committed, it cannot be reversed.

- With 4 validators, the network tolerates **1 faulty node** (⌊(4-1)/3⌋ = 1)
- Blocks finalise in ~2 seconds (`blockperiodseconds: 2`)
- No mining — validators take turns proposing blocks

This means even if one validator is compromised or offline, the other three continue producing blocks and maintaining the immutable anchor history.

## First-time Setup

### Step 1 — Generate validator keys

```bash
node infra/besu/generate-keys.js
```

This creates:
- `validator1/key` through `validator4/key` — secp256k1 private keys
- `rpc-node/key` — key for the RPC node
- Prints Ethereum addresses for each validator

### Step 2 — Update genesis extraData

The `extraData` field in `genesis.json` must encode the validator addresses. Use the addresses printed by `generate-keys.js` and the Besu QBFT genesis tool:

```bash
besu operator generate-blockchain-config \
  --config-file=qbftConfigFile.json \
  --to=networkFiles \
  --private-key-file-name=key
```

Or manually encode using the QBFT RLP format documented at:
https://besu.hyperledger.org/private-networks/how-to/configure/consensus/qbft

### Step 3 — Start the network

```bash
docker-compose up besu-validator1 besu-validator2 besu-validator3 besu-validator4 besu-rpc -d
```

### Step 4 — Verify peers are connected

```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'
```

Expected: `"result": "0x3"` (3 peers for each validator)

### Step 5 — Check block production

```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

Block number should increase every 2 seconds.

## Network Parameters

| Parameter | Value |
|-----------|-------|
| Chain ID | 1337 |
| Block period | 2 seconds |
| Request timeout | 4 seconds |
| Epoch length | 30,000 blocks |
| Gas limit | 0x1fffffffffffff |
| Consensus | QBFT |

## Security Notes

- Private key files (`key`) are committed to git **only for the local dev network**
- In production, keys must be managed via a Hardware Security Module (HSM) or key vault
- Each validator node should be on a separate physical machine or VM
- The RPC node is read-only and does not hold a validator key
