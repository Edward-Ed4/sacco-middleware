// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AnchorRegistry
 * @notice Write-once Merkle root registry for the SACCO middleware.
 *
 * Each SACCO platform periodically batches transaction commitments into a
 * Merkle tree and calls `anchor()` to record the root on-chain. The record
 * is immutable: once a batchId is anchored it cannot be overwritten.
 *
 * Any party (regulator, auditor, end-user) can call `getRoot()` or
 * `getBatch()` to independently verify that a commitment was included in a
 * specific batch without trusting any off-chain system.
 *
 * @dev Deployed on a private Hyperledger Besu QBFT network with 4 validators
 *      hosted by independent institutions (UMRA, MTIC, SACCO apex union,
 *      independent auditor) so no single party controls the ledger.
 */
contract AnchorRegistry {

    struct Batch {
        bytes32 merkleRoot;
        uint64  seqStart;
        uint64  seqEnd;
        uint64  timestamp;
        address submitter;
    }

    /// @notice batchId => Batch metadata
    mapping(bytes32 => Batch) public batches;

    /// @notice Ordered list of all anchored batchIds
    bytes32[] public batchIds;

    // ── Events ───────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a new batch is successfully anchored.
     * @param batchId    Unique identifier for the batch
     * @param merkleRoot Merkle root of the commitment tree
     * @param seqStart   First sequence number in the batch
     * @param seqEnd     Last sequence number in the batch
     * @param submitter  Address that called anchor()
     */
    event BatchAnchored(
        bytes32 indexed batchId,
        bytes32 indexed merkleRoot,
        uint64  seqStart,
        uint64  seqEnd,
        address submitter
    );

    // ── Errors ───────────────────────────────────────────────────────────────

    error BatchAlreadyAnchored(bytes32 batchId);
    error EmptyMerkleRoot();
    error InvalidSequenceRange(uint64 seqStart, uint64 seqEnd);

    // ── State-mutating functions ──────────────────────────────────────────────

    /**
     * @notice Anchor a batch Merkle root on-chain.
     * @dev    Reverts if the batchId has already been anchored, root is zero,
     *         or seqEnd < seqStart.
     * @param batchId    Unique batch identifier (UUID encoded as bytes32)
     * @param merkleRoot Root of the Merkle tree built from commitment leaves
     * @param seqStart   Inclusive lower bound of the sequence range
     * @param seqEnd     Inclusive upper bound of the sequence range
     */
    function anchor(
        bytes32 batchId,
        bytes32 merkleRoot,
        uint64  seqStart,
        uint64  seqEnd
    ) external {
        if (batches[batchId].timestamp != 0)  revert BatchAlreadyAnchored(batchId);
        if (merkleRoot == bytes32(0))          revert EmptyMerkleRoot();
        if (seqEnd < seqStart)                 revert InvalidSequenceRange(seqStart, seqEnd);

        batches[batchId] = Batch({
            merkleRoot: merkleRoot,
            seqStart:   seqStart,
            seqEnd:     seqEnd,
            timestamp:  uint64(block.timestamp),
            submitter:  msg.sender
        });
        batchIds.push(batchId);

        emit BatchAnchored(batchId, merkleRoot, seqStart, seqEnd, msg.sender);
    }

    // ── View functions ────────────────────────────────────────────────────────

    /**
     * @notice Return the Merkle root for a given batchId.
     * @return The stored root, or bytes32(0) if not anchored.
     */
    function getRoot(bytes32 batchId) external view returns (bytes32) {
        return batches[batchId].merkleRoot;
    }

    /**
     * @notice Return full Batch metadata for a given batchId.
     * @return Batch struct (all fields zero if never anchored).
     */
    function getBatch(bytes32 batchId) external view returns (Batch memory) {
        return batches[batchId];
    }

    /**
     * @notice Return the total number of anchored batches.
     */
    function totalBatches() external view returns (uint256) {
        return batchIds.length;
    }

    /**
     * @notice Check whether a batchId has been anchored.
     */
    function isAnchored(bytes32 batchId) external view returns (bool) {
        return batches[batchId].timestamp != 0;
    }
}
