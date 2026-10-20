-- Migration 001: Add performance indexes
-- Run this after the initial schema is deployed

-- Speed up reconciliation queries (fetches all tenant commitments ordered by seq)
CREATE INDEX IF NOT EXISTS idx_commitments_tenant_seq
  ON commitments(tenant_id, sequence_no ASC);

-- Speed up anchor worker (fetches PENDING commitments)
CREATE INDEX IF NOT EXISTS idx_commitments_pending
  ON commitments(tenant_id, status)
  WHERE status = 'PENDING';

-- Speed up receipt lookup by QR scan
CREATE INDEX IF NOT EXISTS idx_commitments_receipt_id
  ON commitments(receipt_id);

-- Speed up finding queries by severity
CREATE INDEX IF NOT EXISTS idx_findings_unalerted
  ON reconciliation_findings(tenant_id, alerted)
  WHERE alerted = FALSE;

-- Speed up alert dispatch
CREATE INDEX IF NOT EXISTS idx_alerts_pending
  ON alerts(status, created_at)
  WHERE status = 'PENDING';
