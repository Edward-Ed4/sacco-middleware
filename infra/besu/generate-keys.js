'use strict';

const fs = require('fs');
const path = require('path');
const { Wallet, encodeRlp } = require('ethers');

const BASE_DIR = __dirname;
const PROJECT_DIR = path.resolve(BASE_DIR, '..', '..');
const nodes = [
  { dir: 'validator1', role: 'UMRA (Regulator)' },
  { dir: 'validator2', role: 'MTIC (Ministry)' },
  { dir: 'validator3', role: 'SACCO Apex Union' },
  { dir: 'validator4', role: 'Independent Auditor' },
];

function writeKey(directory, wallet) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'key'),
    wallet.privateKey.slice(2),
    { encoding: 'utf8', mode: 0o600 }
  );
}

function updateDeployerEnvironment(privateKey) {
  const envPath = path.join(PROJECT_DIR, '.env');
  if (!fs.existsSync(envPath)) {
    fs.copyFileSync(path.join(PROJECT_DIR, '.env.example'), envPath);
  }

  const contents = fs.readFileSync(envPath, 'utf8');
  const updated = /^DEPLOYER_PRIVATE_KEY=.*$/m.test(contents)
    ? contents.replace(/^DEPLOYER_PRIVATE_KEY=.*$/m, `DEPLOYER_PRIVATE_KEY=${privateKey}`)
    : `${contents.trimEnd()}\nDEPLOYER_PRIVATE_KEY=${privateKey}\n`;
  fs.writeFileSync(envPath, updated, { encoding: 'utf8', mode: 0o600 });
}

const validators = nodes.map(({ dir, role }) => {
  const wallet = Wallet.createRandom();
  writeKey(path.join(BASE_DIR, dir), wallet);
  console.log(`${dir}: ${role} — ${wallet.address}`);
  return wallet;
});

const rpcWallet = Wallet.createRandom();
writeKey(path.join(BASE_DIR, 'rpc-node'), rpcWallet);

const deployer = Wallet.createRandom();
const vanity = `0x${'00'.repeat(32)}`;
const extraData = encodeRlp([
  vanity,
  validators.map(wallet => wallet.address.toLowerCase()),
  '0x',
  '0x',
  [],
]);
const fundedBalance = `0x${(1_000_000n * 10n ** 18n).toString(16)}`;
const alloc = Object.fromEntries(
  [...validators, deployer].map(wallet => [
    wallet.address.toLowerCase(),
    { balance: fundedBalance },
  ])
);

const generatedDir = path.join(BASE_DIR, 'generated');
fs.mkdirSync(generatedDir, { recursive: true });
fs.writeFileSync(
  path.join(generatedDir, 'genesis.json'),
  `${JSON.stringify({
    config: {
      chainId: 1337,
      berlinBlock: 0,
      londonBlock: 0,
      qbft: {
        blockperiodseconds: 2,
        epochlength: 30000,
        requesttimeoutseconds: 4,
      },
    },
    nonce: '0x0',
    timestamp: '0x0',
    gasLimit: '0x1fffffffffffff',
    difficulty: '0x1',
    mixHash: '0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365',
    coinbase: '0x0000000000000000000000000000000000000000',
    alloc,
    extraData,
  }, null, 2)}\n`,
  { encoding: 'utf8', mode: 0o600 }
);

updateDeployerEnvironment(deployer.privateKey);

console.log(`\nGenesis written to ${path.join(generatedDir, 'genesis.json')}`);
console.log('Validator and deployer private keys were written locally and were not printed.');
console.log('The generated deployer key was saved to the ignored .env file.');
