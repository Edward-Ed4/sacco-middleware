# SACCO Middleware — Blockchain Tamper-Evidence Plug-in

An asynchronous blockchain middleware plug-in that makes insider tampering with existing Ugandan SACCO databases detectable and enables members to verify their own transactions independently.

## Architecture

```
Layer 1: Existing SACCO System (unchanged except a small adapter)
Layer 2: Secure Ingestion (API Gateway — POST /v1/commit)
Layer 3: Asynchronous Processing (Anchor Worker + Reconciliation Engine)
Layer 4: Data & Consortium Ledger (PostgreSQL + Hyperledger Besu QBFT)
Layer 5: Verification & Presentation (Flutter App + SMS Service + Dashboard)
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| API Gateway | Node.js / Express |
| Queue | Redis Streams |
| Off-chain Store | PostgreSQL |
| Blockchain | Hyperledger Besu QBFT (4 validators) |
| Smart Contract | Solidity 0.8.20 |
| Mobile App | Flutter (Dart) |
| SMS Verification | Africa's Talking API |
| Dashboard | HTML/CSS/JS + Express |

## Quick Start

### Prerequisites
- Node.js >= 18
- Docker Desktop
- Flutter SDK

### 1. Clone and install
```bash
git clone https://github.com/Edward-Ed4/sacco-middleware.git
cd sacco-middleware
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Start infrastructure
```bash
docker-compose up postgres redis -d
```

### 4. Generate Besu validator keys
```bash
node infra/besu/generate-keys.js
```

### 5. Start Besu network
```bash
docker-compose up besu-validator1 besu-validator2 besu-validator3 besu-validator4 besu-rpc -d
```

### 6. Deploy smart contract
```bash
cd blockchain
npm install
npx hardhat run scripts/deploy.js --network besu
# Copy the contract address into your .env as ANCHOR_CONTRACT_ADDRESS
```

### 7. Start all services
```bash
# API Gateway (port 3000)
npm run dev:gateway

# Anchor Worker
npm run dev:anchor

# Reconciliation Engine
npm run dev:reconcile

# SMS Verification Service (port 3002)
npm run dev:sms

# Dashboard (port 3003)
npm run dev:dashboard
```

### 8. Run Flutter app
```bash
cd mobile
flutter pub get
flutter run
```

## API Endpoints

### Register a SACCO Tenant
```
POST /v1/tenants/register
Body: { "name": "Kampala Traders SACCO" }
```

### Commit a Transaction
```
POST /v1/commit
Headers: X-API-Key, X-Request-HMAC
Body: { tx_ref, tx_type, amount, acct_pseudo, tx_timestamp, sequence_no }
```

### Verify a Receipt
```
GET /v1/verify/:receiptId
```

### Health Check
```
GET /health
```

## How Tamper Detection Works

1. Every transaction is hashed with a salt → **leaf commitment**
2. Leaves are chained → **hash chain** (deletions show as gaps)
3. Batches of leaves form **Merkle trees** → roots anchored on Besu
4. Reconciliation engine periodically **recomputes leaves** from the SACCO DB
5. If recomputed ≠ stored → **MODIFIED** alert raised
6. If commitment exists but DB row gone → **DELETED** alert raised
7. If commitment never anchored after 10 min → **UNANCHORED** alert raised

## Privacy (DPPA Compliance)

No names, phone numbers, account numbers, or amounts are written to the blockchain. Only Merkle roots, batch IDs, and sequence ranges go on-chain.

## Group Members

| Name | Student Number | Registration |
|------|---------------|--------------|
| MUKISA COLLIN MAYENDE | 2400724247 | 24/U/24247/PS |
| MUHANGUZI ADAM RIYADH | 2400716980 | 24/U/16980/PS |
| AINEBYONA AUDREY | 2400713411 | 24/U/13411/PS |
| EBAJU EDWARD | 2400723929 | 24/U/23929/PS |

**Supervisor:** Dr. Kalenzi Cornelius  
**Course:** CSC 3118 — Computer Science Project I  
**Semester:** I, 2026/2027
