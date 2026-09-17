// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title AssetAttestation
 * @notice Immutable physical-digital binding attestation registry for the Trust Continuity Platform.
 *
 * @dev Records cryptographically verifiable attestations that link a blockchain asset record
 *      to a submitted physical identifier and state snapshot.
 *
 *      IMPORTANT: An attestation does NOT prove that the physical asset is authentic or exists.
 *      It records that an authorized verifier submitted a cryptographic hash binding at a
 *      specific point in time. The physical identifier must be independently verified off-chain.
 *
 *      Blockchain preserves a tamper-evident record of cryptographic attestations linking
 *      the digital asset record to submitted physical identifier/state hashes.
 *
 *      On-chain data principle:
 *        physicalIdentifierHash = hash(serial number or hardware identifier)
 *        assetStateHash         = hash(canonicalized state record)
 *        No sensitive physical or organizational data is stored on-chain.
 */
contract AssetAttestation is AccessControl {
    // ──────────────────────────────────────────────
    //  Role definitions
    // ──────────────────────────────────────────────

    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // ──────────────────────────────────────────────
    //  Data structures
    // ──────────────────────────────────────────────

    struct Attestation {
        uint256 tokenId;
        bytes32 physicalIdentifierHash; // hash(serial number / hardware identifier)
        bytes32 assetStateHash;         // hash(canonicalized state record)
        address attestedBy;             // verifier who submitted this attestation
        uint256 timestamp;              // block timestamp of submission
        bool    valid;                  // false if invalidated by admin
    }

    /// @notice Full attestation history per token (append-only)
    mapping(uint256 => Attestation[]) private _attestations;

    /// @notice Total attestations ever submitted
    uint256 public totalAttestations;

    // ──────────────────────────────────────────────
    //  Custom errors
    // ──────────────────────────────────────────────

    error InvalidTokenId();
    error InvalidPhysicalHash();
    error InvalidStateHash();
    error AttestationIndexOutOfBounds();
    error AlreadyInvalidated();

    // ──────────────────────────────────────────────
    //  Events (immutable audit trail)
    // ──────────────────────────────────────────────

    /// @notice Emitted when a new attestation is submitted
    event AttestationSubmitted(
        uint256 indexed tokenId,
        uint256 indexed attestationIndex,
        bytes32 physicalIdentifierHash,
        bytes32 assetStateHash,
        address indexed attestedBy,
        uint256 timestamp
    );

    /// @notice Emitted when an attestation is invalidated by admin
    event AttestationInvalidated(
        uint256 indexed tokenId,
        uint256 indexed attestationIndex,
        address invalidatedBy,
        uint256 timestamp
    );

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    // ──────────────────────────────────────────────
    //  Attestation submission
    // ──────────────────────────────────────────────

    /**
     * @notice Submit a physical-digital binding attestation for a governed asset.
     * @dev Only VERIFIER_ROLE can submit. Records are append-only and immutable.
     *      Submitting a new attestation does NOT invalidate prior records —
     *      the full history is preserved for audit reconstruction.
     * @param tokenId                Token ID of the asset being attested
     * @param physicalIdentifierHash Hash of physical identifier (serial number, HW ID)
     * @param assetStateHash         Hash of canonicalized asset state record
     */
    function submitAttestation(
        uint256 tokenId,
        bytes32 physicalIdentifierHash,
        bytes32 assetStateHash
    ) external onlyRole(VERIFIER_ROLE) {
        if (physicalIdentifierHash == bytes32(0)) revert InvalidPhysicalHash();
        if (assetStateHash == bytes32(0)) revert InvalidStateHash();

        uint256 idx = _attestations[tokenId].length;

        _attestations[tokenId].push(Attestation({
            tokenId:                tokenId,
            physicalIdentifierHash: physicalIdentifierHash,
            assetStateHash:         assetStateHash,
            attestedBy:             msg.sender,
            timestamp:              block.timestamp,
            valid:                  true
        }));

        totalAttestations++;

        emit AttestationSubmitted(
            tokenId,
            idx,
            physicalIdentifierHash,
            assetStateHash,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Invalidate a specific attestation record (e.g. erroneous submission).
     * @dev Only DEFAULT_ADMIN_ROLE can invalidate. The record itself is preserved
     *      for audit purposes — only the valid flag is set to false.
     * @param tokenId Token ID of the asset
     * @param index   Index of the attestation to invalidate
     */
    function invalidateAttestation(uint256 tokenId, uint256 index) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (index >= _attestations[tokenId].length) revert AttestationIndexOutOfBounds();
        if (!_attestations[tokenId][index].valid) revert AlreadyInvalidated();

        _attestations[tokenId][index].valid = false;
        emit AttestationInvalidated(tokenId, index, msg.sender, block.timestamp);
    }

    // ──────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────

    /**
     * @notice Get the number of attestations for a token
     */
    function getAttestationCount(uint256 tokenId) external view returns (uint256) {
        return _attestations[tokenId].length;
    }

    /**
     * @notice Get a specific attestation by token ID and index
     */
    function getAttestation(uint256 tokenId, uint256 index)
        external
        view
        returns (
            bytes32 physicalIdentifierHash,
            bytes32 assetStateHash,
            address attestedBy,
            uint256 timestamp,
            bool    valid
        )
    {
        if (index >= _attestations[tokenId].length) revert AttestationIndexOutOfBounds();
        Attestation storage a = _attestations[tokenId][index];
        return (a.physicalIdentifierHash, a.assetStateHash, a.attestedBy, a.timestamp, a.valid);
    }

    /**
     * @notice Get the most recent valid attestation for a token.
     * @return found  False if no valid attestation exists
     */
    function getLatestValidAttestation(uint256 tokenId)
        external
        view
        returns (
            bool    found,
            bytes32 physicalIdentifierHash,
            bytes32 assetStateHash,
            address attestedBy,
            uint256 timestamp
        )
    {
        uint256 len = _attestations[tokenId].length;
        for (uint256 i = len; i > 0; i--) {
            Attestation storage a = _attestations[tokenId][i - 1];
            if (a.valid) {
                return (true, a.physicalIdentifierHash, a.assetStateHash, a.attestedBy, a.timestamp);
            }
        }
        return (false, bytes32(0), bytes32(0), address(0), 0);
    }

    /**
     * @notice Check whether a specific physical+state hash pair has a valid attestation on record
     * @dev Used by TrustContinuity validation to verify attestation before a transfer.
     */
    function hasValidAttestation(
        uint256 tokenId,
        bytes32 physicalIdentifierHash,
        bytes32 assetStateHash
    ) external view returns (bool) {
        uint256 len = _attestations[tokenId].length;
        for (uint256 i = len; i > 0; i--) {
            Attestation storage a = _attestations[tokenId][i - 1];
            if (
                a.valid &&
                a.physicalIdentifierHash == physicalIdentifierHash &&
                a.assetStateHash == assetStateHash
            ) {
                return true;
            }
        }
        return false;
    }
}
