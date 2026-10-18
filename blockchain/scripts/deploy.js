'use strict';
const hre = require('hardhat');

async function main() {
  const AnchorRegistry = await hre.ethers.getContractFactory('AnchorRegistry');
  const registry = await AnchorRegistry.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log('AnchorRegistry deployed to:', address);
  console.log('Set ANCHOR_CONTRACT_ADDRESS=' + address + ' in your .env');
}

main().catch((err) => { console.error(err); process.exit(1); });
