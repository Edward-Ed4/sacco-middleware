# API Reference

Base URL: `http://localhost:3000`

All endpoints use HTTPS in production. Commit endpoints require authentication headers.

---

## Authentication

Every request to `/v1/commit` must include:

| Header | Value |
|--------|-------|
| `X-API-Key` | Your tenant API key (returned at registration) |
| `X-Request-HMAC` | `HMAC-SHA256(rawBody, hmacKey)` as hex |

---

## Endpoints

### Health Check
```
GET /health
```
**Response 200:**
```json
{
  "status": "healthy",
  "checks": { "postgres": "ok", "redis": "ok" },
  "version": "1.0.0",
  "ts": "2026-10-18T08:00:00.000Z"
}
```

---

### Register Tenant
```
POST /v1/tenants/register
```
**Body:**
```json
{ "name": "Kampala Traders SACCO" }
```
**Response 201:**
```json
{
  "tenantId": "uuid",
  "name": "Kampala Traders SACCO",
  "apiKey": "hex-64-chars",
  "hmacKeyHex": "hex-64-chars",
  "signingPrivateKeyHex": "hex",
  "signingPublicKeyHex": "hex",
  "warning": "Store these credentials securely. They will not be shown again."
}
```

---

### Commit a Transaction
```
POST /v1/commit
```
**Body:**
```json
{
  "tx_ref":       "TXN-2026-001",
  "tx_type":      "deposit",
  "amount":       150000,
  "acct_pseudo":  "sha256_of_account_number",
  "tx_timestamp": "2026-10-18T08:00:00Z",
  "sequence_no":  1,
  "phone_number": "+256700000000"
}
```
**Response 202:**
```json
{
  "receiptId":        "uuid",
  "qrPayload":        "base64url-ed25519-signed-receipt",
  "verificationCode": "R26NGV",
  "status":           "PENDING"
}
```

---

### Verify a Receipt (Smartphone)
```
GET /v1/verify/:receiptId
```
**Response 200:**
```json
{
  "receiptId":   "uuid",
  "txRef":       "TXN-2026-001",
  "txType":      "deposit",
  "amount":      "150000.00",
  "txTimestamp": "2026-10-18T08:00:00Z",
  "sequenceNo":  1,
  "leafHex":     "hex-64-chars",
  "status":      "ANCHORED",
  "merkleProof": [{ "sibling": "hex", "position": "right" }],
  "merkleRoot":  "hex-64-chars",
  "blockNumber": 42,
  "txHash":      "0x..."
}
```

---

### Verify Proof (Client-side check)
```
POST /v1/verify/proof
```
**Body:**
```json
{
  "leafHex":  "hex",
  "proof":    [{ "sibling": "hex", "position": "right" }],
  "rootHex":  "hex"
}
```
**Response:**
```json
{ "valid": true }
```

---

## SMS Verification Service

Base URL: `http://localhost:3002`

### Send Verification Code
```
POST /sms/send
Body: { "phoneNumber": "+256700000000", "receiptId": "uuid" }
```

### Verify Code
```
POST /sms/verify
Body: { "phoneNumber": "+256700000000", "code": "R26NGV", "receiptId": "uuid" }
```
**Response 200:**
```json
{
  "verified":    true,
  "receiptId":   "uuid",
  "txRef":       "TXN-2026-001",
  "txType":      "deposit",
  "amount":      "150000.00",
  "status":      "ANCHORED",
  "message":     "Transaction is recorded and anchored on the blockchain."
}
```
**Lockout:** After 3 failed attempts the phone number is locked for 15 minutes.

---

## Dashboard API

Base URL: `http://localhost:3003`

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | Summary counts |
| `GET /api/findings` | Reconciliation findings |
| `GET /api/batches` | Anchor batch history |
| `GET /api/reconciliation` | Reconciliation run history |
| `GET /api/alerts` | Alert log |
| `GET /api/tenants` | Registered tenants |
