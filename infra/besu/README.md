# Hyperledger Besu — QBFT Network

## Overview

This directory contains the configuration for a permissioned **QBFT** (Quorum Byzantine Fault Tolerant) blockchain network running on Hyperledger Besu. The network consists of **4 validator nodes** and **1 read-only RPC node**, all running as Docker containers defined in `docker-compose.yml`.

---

## How QBFT Works

QBFT is a BFT consensus protocol adapted for Ethereum-compatible chains:

- **Immediate finality** — once a block is added, it is final. There are no forks and no reorgs.
- **Round-based proposer rotation** — validators take turns proposing blocks in a round-robin fashion each epoch.
- **Fault tolerance** — a network of `N` validators can tolerate up to `f = ⌊(N−1)/3⌋` faulty (Byzantine) nodes while still reaching consensus. With 4 validators, `f = 1`, meaning **one validator can fail or misbehave** and the network continues producing blocks.
- **Liveness** — requires at least `2f + 1 = 3` validators to be online and honest to produce blocks.
- **Block period** — set to **2 seconds** in this network (`blockperiodseconds: 2`).
- **Request timeout** — **4 seconds** (`requesttimeoutseconds: 4`); if a proposer does not deliver a block in time, validators move to the next round.

### Why QBFT for SACCO?

The four validators represent distinct governance bodies, each with an independent interest in data integrity:

| Validator | Role |
|-----------|------|
| **Validator 1** | UMRA — Regulatory authority |
| **Validator 2** | MTIC — Ministry of Trade, Industry and Cooperatives |
| **Validator 3** | SACCO Apex Union — Industry self-regulator |
| **Validator 4** | Independent Auditor — External assurance |

No single party controls block production. A coalition of at least 3 must agree for any Merkle root to be anchored on-chain.

---

## Directory Structure

```
infra/besu/
├── genesis.json          # Shared QBFT genesis block (chainId 1337)
├── generate-keys.js      # Script to create validator private key files
├── README.md             # This file
├── validator1/
│   ├── config.toml       # Besu config for Validator 1
│   └── key               # secp256k1 private key (32-byte hex, no 0x)
├── validator2/
│   ├── config.toml
│   └── key
├── validator3/
│   ├── config.toml
│   └── key
├── validator4/
│   ├── config.toml
│   └── key
└── rpc-node/
    ├── config.toml       # Non-validator, sync-mode=FULL, read-only RPC
    └── (no key file)
```

---

## First-Time Setup

### 1. Generate validator keys

```bash
node infra/besu/generate-keys.js
```

This writes a random 32-byte hex private key to each `validatorN/key` file.
It also prints the Ethereum address for each validator — you will need these
to build the QBFT `extraData` field in `genesis.json`.

### 2. Build the QBFT `extraData`

Besu's QBFT genesis `extraData` encodes the initial validator set. Use the
[Besu QBFT genesis builder](https://besu.hyperledger.org/private-networks/how-to/configure/consensus/qbft)
or the `besu operator generate-blockchain-config` tool with the four validator
addresses printed in step 1.

Update `genesis.json`'s `extraData` field with the result before starting the
network for the first time.

### 3. Start the network

```bash
docker-compose up besu-validator1 besu-validator2 besu-validator3 besu-validator4 besu-rpc
```

Or in detached mode:

```bash
docker-compose up -d besu-validator1 besu-validator2 besu-validator3 besu-validator4 besu-rpc
```

### 4. Verify the network is producing blocks

```bash
curl -s -X POST http://localhost:8545 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

The `result` field should increment every 2 seconds.

### 5. Check validator set

```bash
curl -s -X POST http://localhost:8545 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"qbft_getValidatorsByBlockNumber","params":["latest"],"id":1}'
```

---

## Network Parameters

| Parameter | Value |
|-----------|-------|
| Chain ID | 1337 |
| Consensus | QBFT |
| Block period | 2 seconds |
| Epoch length | 30 000 blocks |
| Request timeout | 4 seconds |
| Gas limit | `0x1fffffffffffff` |
| RPC port (validators) | 8545 |
| RPC port (rpc-node, host) | 8546 |
| P2P port | 30303 |

---

## Deploying Contracts

After the network is running, deploy the `AnchorRegistry` contract:

```bash
cd blockchain
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network besu
```

Set the printed address as `ANCHOR_CONTRACT_ADDRESS` in your `.env` file.

---

## Stopping the Network

```bash
docker-compose down
```

To also wipe chain data (full reset):

```bash
docker-compose down -v
```

---

## Security Notes

- The `key` files in this repository are for **local development only**.
- For any shared or production deployment, generate keys offline, store them in a secrets manager, and never commit them to version control.
- The `rpc-node` has no private key and does not participate in consensus; it is safe to expose its RPC port to internal services.
