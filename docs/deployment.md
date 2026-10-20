# Deployment Guide

## Prerequisites

- Docker Desktop (WSL 2 backend)
- Node.js >= 18
- Flutter SDK >= 3.0
- Git

## Step-by-step Deployment

### 1. Clone the repository

```bash
git clone https://github.com/Edward-Ed4/sacco-middleware.git
cd sacco-middleware
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `BESU_RPC_URL` | Besu RPC node URL |
| `ANCHOR_CONTRACT_ADDRESS` | Deployed AnchorRegistry address |
| `SIGNING_PRIVATE_KEY` | Ed25519 private key hex for receipt signing |
| `SMS_HMAC_KEY` | HMAC key for SMS code generation |
| `AT_API_KEY` | Africa's Talking API key |
| `DEPLOYER_PRIVATE_KEY` | Private key for deploying/calling smart contract |

### 3. Start infrastructure services

```bash
docker-compose up postgres redis -d
```

Wait for PostgreSQL to be ready (check with `docker logs sacco_postgres`).

### 4. Generate Besu validator keys

```bash
node infra/besu/generate-keys.js
```

This creates `infra/besu/validator1/key` through `validator4/key` and the `rpc-node/key`.

### 5. Start the Besu QBFT network

```bash
docker-compose up besu-validator1 besu-validator2 besu-validator3 besu-validator4 besu-rpc -d
```

Check validators are peered:
```bash
curl -X POST --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' http://localhost:8545
```

### 6. Deploy the AnchorRegistry smart contract

```bash
cd blockchain
npm install
npx hardhat run scripts/deploy.js --network besu
```

Copy the printed contract address into `.env` as `ANCHOR_CONTRACT_ADDRESS`.

### 7. Install all Node.js dependencies

```bash
cd ..
npm install
```

### 8. Start all backend services

In separate terminals:

```bash
# API Gateway
npm run dev:gateway        # port 3000

# Anchor Worker
npm run dev:anchor         # port 3001 (health)

# Reconciliation Engine
npm run dev:reconcile      # port 9091 (metrics)

# SMS Verification Service
npm run dev:sms            # port 3002

# Dashboard
npm run dev:dashboard      # port 3003
```

### 9. Register a test SACCO tenant

```bash
curl -X POST http://localhost:3000/v1/tenants/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Test SACCO"}'
```

Save the returned `apiKey`, `hmacKeyHex`, and `signingPrivateKeyHex`.

### 10. Submit a test transaction

```bash
# Compute HMAC of the body using your hmacKeyHex
# Then:
curl -X POST http://localhost:3000/v1/commit \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <your-api-key>" \
  -H "X-Request-HMAC: <computed-hmac>" \
  -d '{
    "tx_ref": "TXN-001",
    "tx_type": "deposit",
    "amount": 150000,
    "acct_pseudo": "abc123hash",
    "tx_timestamp": "2026-10-18T10:00:00Z",
    "sequence_no": 1,
    "phone_number": "+256700000000"
  }'
```

### 11. Open the dashboard

Visit `http://localhost:3003` to see the auditor/regulator dashboard.

### 12. Run the Flutter app

```bash
cd mobile
flutter pub get
flutter run
```

## Verifying the System Works

1. Submit a transaction via the commit endpoint
2. Wait ~15 seconds for the anchor worker to batch and anchor it
3. Check the dashboard — the commitment should show as ANCHORED
4. Scan the QR code in the Flutter app — it should show VALID with a block number
5. Try sending the SMS code to the SMS verification service

## Stopping

```bash
docker-compose down
```
