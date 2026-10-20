# System Architecture

## Overview

The SACCO middleware plug-in follows a 5-layer, event-driven architecture that separates a fast synchronous ingestion path from a slower asynchronous anchoring path. This separation is what allows the plug-in to add tamper evidence without slowing the SACCO system.

## Layers

### Layer 1: Tenant Integration (Existing SACCO System)
- The SACCO's core-banking application and database (MOBIS, Saccowave, SaccoSys, etc.)
- An **integration adapter** (SDK call or outbox reader) sends a minimal pseudonymous payload for each transaction
- A **read-only replica** with SELECT-only credentials serves reconciliation — the plug-in never needs write access to the SACCO database

### Layer 2: Secure Ingestion (API Gateway)
- Exposes `POST /v1/commit`
- **Authentication**: API key + HMAC request signature over TLS 1.3
- **Validation and canonicalisation**: converts payload to a fixed byte form
- **Commitment engine**: computes the salted SHA-256 leaf and extends the hash chain
- **Receipt issuer**: returns an Ed25519-signed QR payload and a 6-character Crockford Base32 code
- Target latency: p95 ≤ 50ms

### Layer 3: Asynchronous Processing
- **Durable queue** (Redis Streams): decouples ingestion from anchoring
- **Anchor worker**: batches commitments every T seconds or N items, builds a Merkle tree, submits root to blockchain
- **Reconciliation engine**: periodically recomputes commitments from replica and compares with stored/anchored values
- **Alert service**: notifies officials by SMS, email, and dashboard

### Layer 4: Data and Consortium Ledger
- **Off-chain store** (PostgreSQL): tenants, commitments, salts, hash-chain values, Merkle proofs, codes, alerts (no PII on-chain)
- **Consortium ledger**: private Besu network with four QBFT validators hosted by separate institutions
  - Validator 1: UMRA (Regulator)
  - Validator 2: MTIC (Ministry)
  - Validator 3: SACCO Apex Union
  - Validator 4: Independent Auditor
- **AnchorRegistry** Solidity contract: write-once Merkle root storage
- **Read-only RPC node**: serves verification queries without exposing validators

### Layer 5: Verification and Presentation
- **Verification API**: serves Merkle proofs (app checks every proof against blockchain root)
- **SMS verification service**: handles codes from feature phones with rate limiting
- **Flutter app**: serves smartphone users with QR scanning
- **Auditor/regulator dashboard**: shows anchoring status and alerts

## Data Flow

```
1. Teller records transaction in core-banking system
2. Adapter sends signed payload → POST /v1/commit
3. Gateway computes commitment, stores PENDING, appends to Redis stream
4. Gateway returns 202 Accepted with receipt ID + QR payload + SMS code (< 50ms)
5. Anchor worker builds Merkle tree, calls anchor(batchId, root, seqRange) on Besu
6. Worker marks commitments ANCHORED, stores Merkle proofs
7. Reconciliation engine reads rows from replica, recomputes commitments
8. MODIFIED/DELETED/UNANCHORED records → alert service → dashboard
9. Member verifies: SMS code to verification service OR Flutter app scans QR
10. App reads anchored root from read-only RPC node, checks proof → VALID or NOT VALID
```

## Cryptographic Scheme

```
leaf_i     = SHA-256(canon(tx_i) || salt_i)       // 128-bit fresh salt per transaction
chain_i    = SHA-256(chain_(i-1) || leaf_i || seq_i)  // hash chain links
merkle_root = root of binary Merkle tree over batch of leaves
```

- Salt prevents guessing transaction contents from the commitment
- Hash chain exposes deletions as gaps
- Merkle batching: one blockchain transaction anchors many commitments, each individually provable
- Only Merkle roots, batch IDs, and sequence ranges go on-chain (DPPA compliant)

## Threat Model

| Threat | Control |
|--------|---------|
| Insider edits a transaction row | Recomputed commitment ≠ anchored root |
| Insider deletes a transaction row | Hash chain shows a gap |
| Insider inserts row bypassing plug-in | Row flagged UNANCHORED |
| Insider alters off-chain store | Anchored roots held by consortium — cannot be rewritten |
| Forged receipt QR | Ed25519 signature fails verification |
| Guessing SMS codes | Codes bound to phone number + lockout after 3 failures |
| One validator compromised | QBFT tolerates 1 faulty node in 4 |
