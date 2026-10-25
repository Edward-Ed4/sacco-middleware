-- Ensure a receipt identifies exactly one commitment and one SMS verification.
CREATE UNIQUE INDEX IF NOT EXISTS idx_commitments_receipt_id_unique
  ON commitments(receipt_id);

CREATE TABLE IF NOT EXISTS sms_verifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id      UUID NOT NULL UNIQUE REFERENCES commitments(receipt_id),
    phone_number    TEXT NOT NULL,
    attempts        INT NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_receipt ON sms_verifications(receipt_id);
CREATE INDEX IF NOT EXISTS idx_sms_phone ON sms_verifications(phone_number);
