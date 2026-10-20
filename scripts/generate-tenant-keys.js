#!/usr/bin/env node
'use strict';

/**
 * Utility: generate a complete set of tenant credentials locally.
 *
 * Use this when you need to pre-generate credentials before the gateway
 * is running, or to inspect what each field looks like.
 *
 * Usage:
 *   node scripts/generate-tenant-keys.js
 *   node scripts/generate-tenant-keys.js --name "Kampala Traders SACCO"
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

async function main() {
  const nameArg = process.argv.find(a => a.startsWith('--name='));
  const name    = nameArg ? nameArg.split('=')[1] : 'My SACCO';

  // Generate all credentials
  const rawApiKey  = crypto.randomBytes(32).toString('hex');
  const apiKeyHash = await bcrypt.hash(rawApiKey, 10);
  const hmacKeyHex = crypto.randomBytes(32).toString('hex');

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubKeyHex  = publicKey.export({ type: 'spki',  format: 'der' }).toString('hex');
  const privKeyHex = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex');

  console.log('\n' + '═'.repeat(60));
  console.log(`  Generated credentials for: ${name}`);
  console.log('═'.repeat(60));
  console.log('\n⚠️  Store these values securely. Some are shown ONCE only.\n');

  console.log('── For your .env file ─────────────────────────────────────');
  console.log(`SACCO_API_KEY=${rawApiKey}`);
  console.log(`SACCO_HMAC_KEY=${hmacKeyHex}`);
  console.log(`SIGNING_PRIVATE_KEY=${privKeyHex}`);

  console.log('\n── For the tenants table (INSERT) ─────────────────────────');
  console.log(`name:          ${name}`);
  console.log(`api_key_hash:  ${apiKeyHash}`);
  console.log(`hmac_key_hex:  ${hmacKeyHex}`);
  console.log(`signing_pub:   ${pubKeyHex}`);

  console.log('\n── Public key (share with verifiers) ──────────────────────');
  console.log(`signing_pub:   ${pubKeyHex}`);
  console.log('\n' + '═'.repeat(60) + '\n');
}

main().catch(console.error);
