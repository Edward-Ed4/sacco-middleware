// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AnchorRegistry
 * @notice Write-once Merkle root registry for the SACCO middleware.
 *
 * Each SACCO platform periodically batches transaction commitments into a
 * Merkle tree and calls `anchor()` to record the root on-chain.  The record
 * is immutable: once a batchId is anchored it cannot be overwritten.
 *
 * Any party (regulator, auditor, end-user) can call `getRoot()` or
 * `getBatch()` to independently verify that a commitment was included in a
 * specific batch without trusting any off-chain system.
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

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    /**
     * @notice Emitted when a new batch is successfully anchored.
     * @param batchId    Unique identifier for the batch (UUID encoded as bytes32)
     * @param merkleRoot Merkle root of the commitment tree for this batch
     * @param seqStart   First commitment sequence number in the batch
     * @param seqEnd     Last commitment sequence number in the batch
     * @param submitter  Address that called anchor()
     */
    event BatchAnchored(
        bytes32 indexed batchId,
        bytes32 indexed merkleRoot,
        uint64  seqStart,
        uint64  seqEnd,
        address submitter
    );

    // -----------------------------------------------------------------------
    // State-mutating functions
    // -----------------------------------------------------------------------

    /**
     * @notice Anchor a batch Merkle root on-chain.
     * @dev    Reverts if the batchId has already been anchored, if the root is
     *         zero, or if seqEnd < seqStart.
     * @param batchId    Unique batch identifier (e.g. UUID as bytes32)
     * @param merkleRoot Root of the Merkle tree built from commitment leaf hashes
     * @param seqStart   Inclusive lower bound of the sequence-number range
     * @param seqEnd     Inclusive upper bound of the sequence-number range
     */
    function anchor(
        bytes32 batchId,
        bytes32 merkleRoot,
        uint64  seqStart,
        uint64  seqEnd
    ) external {
        require(batches[batchId].timestamp == 0, "Batch already anchored");
        require(merkleRoot != bytes32(0), "Empty root");
        require(seqEnd >= seqStart, "Invalid sequence range");

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

    // -----------------------------------------------------------------------
    // View functions
    // -----------------------------------------------------------------------

    /**
     * @notice Return the Merkle root for a given batchId.
     * @param batchId The batch identifier to query.
     * @return The stored Merkle root, or bytes32(0) if not anchored.
     */
    function getRoot(bytes32 batchId) external view returns (bytes32) {
        return batches[batchId].merkleRoot;
    }

    /**
     * @notice Return full Batch metadata for a given batchId.
     * @param batchId The batch identifier to query.
     * @return A Batch struct (all fields zero if the batch was never anchored).
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
}
