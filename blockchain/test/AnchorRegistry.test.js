const { expect } = require('chai');
const { ethers } = require('hardhat');
const { randomBytes } = require('crypto');

describe('AnchorRegistry', function () {
  let registry;

  beforeEach(async function () {
    const Factory = await ethers.getContractFactory('AnchorRegistry');
    registry = await Factory.deploy();
    await registry.waitForDeployment();
  });

  it('anchors a batch and emits event', async function () {
    const batchId    = '0x' + randomBytes(32).toString('hex');
    const merkleRoot = '0x' + randomBytes(32).toString('hex');
    const tx = await registry.anchor(batchId, merkleRoot, 1n, 50n);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
    const stored = await registry.getRoot(batchId);
    expect(stored).to.equal(merkleRoot);
  });

  it('rejects duplicate batch', async function () {
    const batchId    = '0x' + randomBytes(32).toString('hex');
    const merkleRoot = '0x' + randomBytes(32).toString('hex');
    await registry.anchor(batchId, merkleRoot, 1n, 10n);
    await expect(registry.anchor(batchId, merkleRoot, 1n, 10n))
      .to.be.revertedWith('Batch already anchored');
  });

  it('tracks total batches', async function () {
    for (let i = 0; i < 3; i++) {
      await registry.anchor(
        '0x' + randomBytes(32).toString('hex'),
        '0x' + randomBytes(32).toString('hex'),
        BigInt(i * 10 + 1), BigInt(i * 10 + 10)
      );
    }
    expect(await registry.totalBatches()).to.equal(3n);
  });
});
