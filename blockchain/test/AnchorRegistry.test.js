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

  it('anchors a batch and emits BatchAnchored event', async function () {
    const batchId    = '0x' + randomBytes(32).toString('hex');
    const merkleRoot = '0x' + randomBytes(32).toString('hex');
    const tx         = await registry.anchor(batchId, merkleRoot, 1n, 50n);
    const receipt    = await tx.wait();
    expect(receipt.status).to.equal(1);

    const stored = await registry.getRoot(batchId);
    expect(stored).to.equal(merkleRoot);
  });

  it('stores correct batch metadata', async function () {
    const batchId    = '0x' + randomBytes(32).toString('hex');
    const merkleRoot = '0x' + randomBytes(32).toString('hex');
    await registry.anchor(batchId, merkleRoot, 5n, 20n);

    const batch = await registry.getBatch(batchId);
    expect(batch.merkleRoot).to.equal(merkleRoot);
    expect(batch.seqStart).to.equal(5n);
    expect(batch.seqEnd).to.equal(20n);
    expect(batch.submitter).to.be.properAddress;
    expect(batch.timestamp).to.be.gt(0n);
  });

  it('rejects duplicate batch with BatchAlreadyAnchored error', async function () {
    const batchId    = '0x' + randomBytes(32).toString('hex');
    const merkleRoot = '0x' + randomBytes(32).toString('hex');
    await registry.anchor(batchId, merkleRoot, 1n, 10n);

    await expect(registry.anchor(batchId, merkleRoot, 1n, 10n))
      .to.be.revertedWithCustomError(registry, 'BatchAlreadyAnchored');
  });

  it('rejects empty Merkle root with EmptyMerkleRoot error', async function () {
    const batchId   = '0x' + randomBytes(32).toString('hex');
    const zeroRoot  = '0x' + '0'.repeat(64);

    await expect(registry.anchor(batchId, zeroRoot, 1n, 10n))
      .to.be.revertedWithCustomError(registry, 'EmptyMerkleRoot');
  });

  it('rejects invalid sequence range with InvalidSequenceRange error', async function () {
    const batchId    = '0x' + randomBytes(32).toString('hex');
    const merkleRoot = '0x' + randomBytes(32).toString('hex');

    await expect(registry.anchor(batchId, merkleRoot, 10n, 5n))
      .to.be.revertedWithCustomError(registry, 'InvalidSequenceRange');
  });

  it('tracks total batches correctly', async function () {
    for (let i = 0; i < 3; i++) {
      await registry.anchor(
        '0x' + randomBytes(32).toString('hex'),
        '0x' + randomBytes(32).toString('hex'),
        BigInt(i * 10 + 1),
        BigInt(i * 10 + 10)
      );
    }
    expect(await registry.totalBatches()).to.equal(3n);
  });

  it('isAnchored returns true after anchoring', async function () {
    const batchId    = '0x' + randomBytes(32).toString('hex');
    const merkleRoot = '0x' + randomBytes(32).toString('hex');

    expect(await registry.isAnchored(batchId)).to.equal(false);
    await registry.anchor(batchId, merkleRoot, 1n, 5n);
    expect(await registry.isAnchored(batchId)).to.equal(true);
  });

  it('getRoot returns zero bytes32 for unknown batchId', async function () {
    const unknown = '0x' + randomBytes(32).toString('hex');
    const root    = await registry.getRoot(unknown);
    expect(root).to.equal('0x' + '0'.repeat(64));
  });
});
