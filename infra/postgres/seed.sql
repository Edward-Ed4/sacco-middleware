-- Development seed data
-- Creates a test SACCO tenant for local development and testing
-- Run this AFTER init.sql has executed

-- NOTE: The api_key_hash below is the bcrypt hash of:
--   raw API key: "dev_api_key_do_not_use_in_production_abc123"
-- The hmac_key_hex is a test key only.

INSERT INTO tenants (id, name, api_key_hash, hmac_key_hex, signing_pub)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Kampala Traders SACCO (DEV)',
  '$2b$10$nOUIs5kJ7naTuTFkBy1veuK0kSYaQ8F0YHiABRYhWlZNpbH3lG2iy',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '302a300506032b657003210000000000000000000000000000000000000000000000000000000000000000'
) ON CONFLICT DO NOTHING;

-- Insert a few sample committed transactions for dashboard demo
INSERT INTO commitments (
  id, tenant_id, tx_ref, tx_type, amount, acct_pseudo,
  tx_timestamp, sequence_no, salt_hex, leaf_hex, chain_hex, status, receipt_id
) VALUES
  (
    uuid_generate_v4(),
    '00000000-0000-0000-0000-000000000001',
    'TXN-2026-001', 'deposit', 150000.00, 'acct_pseudo_hash_001',
    '2026-10-18T08:00:00Z', 1,
    'aabbccdd11223344aabbccdd11223344',
    'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    'cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe',
    'ANCHORED', uuid_generate_v4()
  ),
  (
    uuid_generate_v4(),
    '00000000-0000-0000-0000-000000000001',
    'TXN-2026-002', 'withdrawal', 50000.00, 'acct_pseudo_hash_002',
    '2026-10-18T09:00:00Z', 2,
    'bbccddee22334455bbccddee22334455',
    'beefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdead',
    'babecafebabecafebabecafebabecafebabecafebabecafebabecafebabecafe',
    'PENDING', uuid_generate_v4()
  ),
  (
    uuid_generate_v4(),
    '00000000-0000-0000-0000-000000000001',
    'TXN-2026-003', 'loan', 500000.00, 'acct_pseudo_hash_003',
    '2026-10-18T10:00:00Z', 3,
    'ccddeeff33445566ccddeeff33445566',
    'feedbeeffeedbeeffeedbeeffeedbeeffeedbeeffeedbeeffeedbeeffeedbee',
    'cafecafecafecafecafecafecafecafecafecafecafecafecafecafecafecafe',
    'ANCHORED', uuid_generate_v4()
  )
ON CONFLICT DO NOTHING;
