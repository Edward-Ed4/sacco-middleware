-- SACCO Middleware Database Schema
-- Runs automatically when the PostgreSQL container first starts

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Tenants ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          TEXT NOT NULL,
    api_key_hash  TEXT NOT NULL UNIQUE,   -- bcrypt hash of the API key
    hmac_key_hex  TEXT NOT NULL,          -- HMAC key for SMS codes (encrypted at rest)
    signing_pub   TEXT NOT NULL,          -- Ed25519 public key (hex)
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Commitments ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commitments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    tx_ref          TEXT NOT NULL,            -- SACCO transaction reference
    tx_type         TEXT NOT NULL,            -- deposit | withdrawal | loan | repayment
    amount          NUMERIC(18,2) NOT NULL,
    acct_pseudo     TEXT NOT NULL,            -- pseudonymous account ref (hashed)
    tx_timestamp    TIMESTAMPTZ NOT NULL,
    sequence_no     BIGINT NOT NULL,
    salt_hex        TEXT NOT NULL,            -- 128-bit random salt (hex)
    leaf_hex        TEXT NOT NULL,            -- SHA-256(canon(tx) || salt)
    chain_hex       TEXT NOT NULL,            -- SHA-256(prev_chain || leaf || seq)
    status          TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | ANCHORED
    batch_id        UUID,
    merkle_proof    JSONB,                    -- array of sibling hashes
    block_number    BIGINT,
    receipt_id      UUID NOT NULL DEFAULT uuid_generate_v4(),
    qr_payload      TEXT,                     -- Ed25519-signed JSON (base64)
    sms_code        TEXT,                     -- 6-char Crockford Base32 code
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, tx_ref)
);

CREATE INDEX IF NOT EXISTS idx_commitments_tenant    ON commitments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commitments_status    ON commitments(status);
CREATE INDEX IF NOT EXISTS idx_commitments_batch     ON commitments(batch_id);
CREATE INDEX IF NOT EXISTS idx_commitments_receipt   ON commitments(receipt_id);

-- ─── Anchor Batches ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anchor_batches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    merkle_root     TEXT NOT NULL,
    seq_start       BIGINT NOT NULL,
    seq_end         BIGINT NOT NULL,
    tx_hash         TEXT,             -- blockchain transaction hash
    block_number    BIGINT,
    anchored_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Reconciliation Results ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reconciliation_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_checked   INT NOT NULL DEFAULT 0,
    valid_count     INT NOT NULL DEFAULT 0,
    modified_count  INT NOT NULL DEFAULT 0,
    deleted_count   INT NOT NULL DEFAULT 0,
    unanchored_count INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reconciliation_findings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id          UUID NOT NULL REFERENCES reconciliation_runs(id),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    tx_ref          TEXT NOT NULL,
    commitment_id   UUID REFERENCES commitments(id),
    finding         TEXT NOT NULL,   -- VALID | MODIFIED | DELETED | UNANCHORED
    detail          JSONB,
    alerted         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_findings_tenant  ON reconciliation_findings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_findings_finding ON reconciliation_findings(finding);

-- ─── Alerts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    finding_id      UUID REFERENCES reconciliation_findings(id),
    channel         TEXT NOT NULL,   -- sms | email | dashboard
    recipient       TEXT NOT NULL,
    message         TEXT NOT NULL,
    sent_at         TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | SENT | FAILED
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SMS Verification Attempts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_verifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id      UUID NOT NULL REFERENCES commitments(receipt_id),
    phone_number    TEXT NOT NULL,
    attempts        INT NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_receipt ON sms_verifications(receipt_id);
CREATE INDEX IF NOT EXISTS idx_sms_phone   ON sms_verifications(phone_number);
