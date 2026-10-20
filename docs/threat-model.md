# Threat Model

## Adversary Profile

The primary adversary is a **privileged insider** — a SACCO employee, board member, or software vendor who has read and write access to the SACCO database and its audit logs.

Secondary adversaries include:
- A member attempting to forge a receipt to claim a false transaction
- An external attacker attempting to guess SMS verification codes
- A single compromised validator node operator

## Assets Under Protection

| Asset | Value |
|-------|-------|
| Transaction records | Financial integrity of all member savings/loans |
| Receipt QR codes | Proof of transaction for members |
| SMS verification codes | Member's ability to independently verify |
| Blockchain anchors | Ultimate tamper evidence |

## Threat Scenarios and Controls

### T1 — Insider edits a transaction row

**Attack:** The SACCO accountant modifies an amount in the database after the transaction is committed.

**Detection:** The reconciliation engine recomputes `SHA-256(canon(tx) || salt)` from the current DB row. The recomputed leaf no longer matches the stored leaf, and certainly not the anchored Merkle root. Finding is raised as **MODIFIED**.

**Control strength:** Detects any field change covered by canonicalisation (amount, tx_type, acct_pseudo, timestamp, sequence_no, tx_ref, tenant_id).

---

### T2 — Insider deletes a transaction row

**Attack:** The SACCO manager deletes a loan disbursement row to hide a misappropriation.

**Detection (method 1):** The commitment for that receipt_id still exists in the off-chain store. The reconciliation engine cannot find the corresponding row in the SACCO DB replica, raising a **DELETED** finding.

**Detection (method 2):** The hash chain shows a sequence gap — `chain_i` links to `chain_(i-1)` via the leaf and sequence number. A deleted row breaks the chain continuity.

---

### T3 — Insider inserts a false row bypassing the plug-in

**Attack:** The insider directly inserts a row into the SACCO database without going through the commit endpoint, to backdate or fabricate a transaction.

**Detection:** The reconciliation engine finds a row in the SACCO DB with no corresponding commitment in the off-chain store. The row is flagged **UNANCHORED**.

---

### T4 — Insider alters the off-chain store

**Attack:** The insider compromises the PostgreSQL off-chain store and alters both the DB row and the stored commitment (leaf, chain, Merkle proof).

**Detection:** The anchored Merkle roots are held by the consortium blockchain (4 independent validators). Even if the off-chain store is altered, the Merkle proof verification against the on-chain root will fail. The Flutter app reads the root directly from the read-only RPC node.

**Limitation:** If the anchor worker has not yet anchored a commitment (PENDING window ≤ 15s), altering both stores before anchoring would be undetectable. The system mitigates this by keeping the PENDING window short and flagging commitments that stay PENDING beyond 10 minutes.

---

### T5 — Forged or altered receipt QR code

**Attack:** Someone creates a fake receipt QR code or alters a legitimate one to show a different amount.

**Detection:** The QR payload carries an Ed25519 signature. Any alteration to the signed fields (amount, tx_ref, txType, etc.) causes signature verification to fail in the Flutter app. The app shows **NOT VALID**.

---

### T6 — Guessing SMS verification codes

**Attack:** An attacker submits brute-force guesses at the 6-character code.

**Mitigation:**
- Code space: 32^6 ≈ 1.07 × 10⁹ possible codes
- Code is bound to the member's registered phone number — wrong phone = rejected
- Lockout after 3 consecutive failures for 15 minutes

---

### T7 — One validator node compromised

**Attack:** One of the four Besu QBFT validator nodes is taken over by an attacker.

**Mitigation:** QBFT requires ≥ ⌊(n-1)/3⌋ + 1 honest validators. With 4 nodes, 1 faulty node is tolerated. The attacker cannot forge new blocks or rewrite existing ones with only 1 of 4 validators.

---

## Out of Scope

- Collusion between 2+ validator operators (Byzantine supermajority)
- Physical compromise of all validator machines simultaneously
- Vulnerabilities in the Hyperledger Besu software itself
- Key theft from the gateway signing key (mitigated by key vault in production)
