-- Migration 002: Add tenant statistics view
-- Provides a fast summary per tenant used by the dashboard

CREATE OR REPLACE VIEW tenant_stats AS
SELECT
  t.id                                                          AS tenant_id,
  t.name                                                        AS tenant_name,
  t.active,
  COUNT(c.id)                                                   AS total_commitments,
  COUNT(c.id) FILTER (WHERE c.status = 'ANCHORED')              AS anchored_count,
  COUNT(c.id) FILTER (WHERE c.status = 'PENDING')               AS pending_count,
  COUNT(ab.id)                                                  AS total_batches,
  COUNT(rf.id) FILTER (WHERE rf.finding = 'MODIFIED')           AS modified_count,
  COUNT(rf.id) FILTER (WHERE rf.finding = 'DELETED')            AS deleted_count,
  COUNT(rf.id) FILTER (WHERE rf.finding = 'UNANCHORED')         AS unanchored_count,
  MAX(c.created_at)                                             AS last_transaction_at,
  MAX(ab.anchored_at)                                           AS last_anchored_at
FROM tenants t
LEFT JOIN commitments c          ON c.tenant_id = t.id
LEFT JOIN anchor_batches ab      ON ab.tenant_id = t.id
LEFT JOIN reconciliation_findings rf ON rf.tenant_id = t.id
GROUP BY t.id, t.name, t.active;
