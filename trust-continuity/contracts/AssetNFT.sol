// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title IIdentityRegistry
 * @notice Interface for the IdentityRegistry contract
 */
interface IIdentityRegistry {
    function isActive(address identity) external view returns (bool);
}

/**
 * @title AssetNFT
 * @notice ERC-721 token representing governed asset records for the Trust Continuity Platform.
 *
 * @dev Each token is a unique digital record and control handle for a governed asset.
 *      The token does NOT mean the physical asset "exists on the blockchain" —
 *      it represents the authoritative digital record, custody state, and cryptographic
 *      attestation binding for the governed asset.
 *
 *      Authorization requires BOTH:
 *        1. Correct role (MANAGER_ROLE via AccessControl)
 *        2. Active identity in IdentityRegistry
 *      This dual-check is the Trust Continuity authorization baseline.
 *
 *      Standard ERC-721 transfers (transferFrom, safeTransferFrom) are DISABLED.
 *      Custody changes ONLY happen through custodyTransfer() or trustedTransfer()
 *      (the latter callable only by the authorized TransferLifecycle contract).
 *
 *      Asset State Lifecycle:
 *        REGISTERED → ALLOCATED → IN_CUSTODY → UNDER_INSPECTION
 *        → TRANSFER_PENDING → TRANSFERRED / SUSPENDED / REVOKED
 *
 *      On-chain data principle:
 *        - Only hashes/references are stored, not sensitive physical or organizational data.
 *        - physicalIdentifierHash = hash(serial number or hardware identifier)
 *        - assetStateHash         = hash(canonicalized asset-state record)
 *        - metadataHash           = hash(off-chain metadata blob)
 *
 *      Roles:
 *        DEFAULT_ADMIN_ROLE : Grant/revoke roles, manage lifecycle contract, suspend/revoke assets
 *        MANAGER_ROLE       : Mint assets, transfer custody, attest assets, update state
 *        AUDITOR_ROLE       : View-only (no state-modifying privileges)
 *        USER_ROLE          : Can receive assets; no manager-level operations
 */
contract AssetNFT is ERC721, AccessControl {
    // ──────────────────────────────────────────────
    //  Role definitions
    // ──────────────────────────────────────────────

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant USER_ROLE    = keccak256("USER_ROLE");

    // ──────────────────────────────────────────────
    //  Asset State Enum
    // ──────────────────────────────────────────────

    enum AssetState {
        REGISTERED,         // 0 — minted and recorded
        ALLOCATED,          // 1 — assigned to an identity/unit
        IN_CUSTODY,         // 2 — in active physical custody
        UNDER_INSPECTION,   // 3 — temporarily under audit/inspection
        TRANSFER_PENDING,   // 4 — transfer lifecycle initiated
        TRANSFERRED,        // 5 — transfer completed, history preserved
        SUSPENDED,          // 6 — temporarily blocked by admin
        REVOKED             // 7 — permanently decommissioned
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice Reference to the IdentityRegistry for active-identity checks
    IIdentityRegistry public identityRegistry;

    /// @notice Address of the authorized TransferLifecycle contract
    address public lifecycleContract;

    /// @notice Asset metadata stored on-chain per token
    struct AssetData {
        string    assetId;                // human-readable identifier (e.g. "SEC-ASSET-A001")
        string    name;                   // human-readable asset name
        string    description;            // asset description / purpose
        bytes32   documentHash;           // hash of associated specification document
        address   custodian;              // current custodian of the asset
        address   createdBy;              // manager who minted the asset
        uint256   createdAt;              // block timestamp when minted
        AssetState status;               // current lifecycle state
        bytes32   physicalIdentifierHash; // hash(serial number / hardware identifier)
        bytes32   assetStateHash;         // hash(canonicalized state record for off-chain verification)
        bytes32   metadataHash;           // hash(off-chain metadata blob)
        uint256   lastAttestation;        // timestamp of last physical attestation
        address   attestedBy;             // who submitted the last attestation
    }

    /// @notice Asset data for each token ID
    mapping(uint256 => AssetData) public assets;

    /// @notice Total number of assets minted
    uint256 public totalAssets;

    /// @notice Number of DEFAULT_ADMIN_ROLE holders (for last-admin protection)
    uint256 private _adminCount;

    // ──────────────────────────────────────────────
    //  Custom errors
    // ──────────────────────────────────────────────

    error IdentityNotActive();
    error NotManager();
    error AssetDoesNotExist();
    error InvalidCustodian();
    error CannotRemoveLastAdmin();
    error DirectTransferDisabled();
    error NotLifecycleContract();
    error AssetNotInAllowedState(AssetState current, AssetState required);
    error AssetSuspendedOrRevoked();

    // ──────────────────────────────────────────────
    //  Events (immutable audit trail)
    // ──────────────────────────────────────────────

    /// @notice Emitted when a new asset record is minted
    event AssetMinted(
        uint256 indexed tokenId,
        string  assetId,
        address indexed custodian,
        address indexed createdBy,
        bytes32 documentHash,
        uint256 timestamp
    );

    /// @notice Emitted when asset custody is transferred
    event AssetCustodyTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        address transferredBy,
        uint256 timestamp
    );

    /// @notice Emitted when asset lifecycle state changes
    event AssetStateChanged(
        uint256 indexed tokenId,
        AssetState previousState,
        AssetState newState,
        address changedBy,
        uint256 timestamp
    );

    /// @notice Emitted when a physical-digital attestation is recorded
    event AssetAttested(
        uint256 indexed tokenId,
        bytes32 physicalIdentifierHash,
        bytes32 assetStateHash,
        address indexed attestedBy,
        uint256 timestamp
    );

    /// @notice Emitted when asset is suspended by admin
    event AssetSuspended(
        uint256 indexed tokenId,
        address suspendedBy,
        uint256 timestamp
    );

    /// @notice Emitted when asset is revoked/decommissioned by admin
    event AssetRevoked(
        uint256 indexed tokenId,
        address revokedBy,
        uint256 timestamp
    );

    /// @notice Emitted when the lifecycle contract address is set
    event LifecycleContractSet(address indexed lifecycleContract, uint256 timestamp);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    /**
     * @dev Requires MANAGER_ROLE AND active identity in IdentityRegistry.
     *      This is the Trust Continuity dual-authorization check:
     *      role assignment alone is insufficient without an active identity.
     */
    modifier onlyActiveManager() {
        if (!hasRole(MANAGER_ROLE, msg.sender)) revert NotManager();
        if (!identityRegistry.isActive(msg.sender)) revert IdentityNotActive();
        _;
    }

    /**
     * @dev Requires the caller to be the authorized TransferLifecycle contract.
     */
    modifier onlyLifecycle() {
        if (msg.sender != lifecycleContract) revert NotLifecycleContract();
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /**
     * @notice Deploy the AssetNFT contract
     * @param _identityRegistry Address of the deployed IdentityRegistry contract
     */
    constructor(address _identityRegistry) ERC721("Trust Continuity Asset", "TCA") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    // ──────────────────────────────────────────────
    //  Admin configuration
    // ──────────────────────────────────────────────

    /**
     * @notice Set the authorized TransferLifecycle contract address.
     * @dev Only callable by DEFAULT_ADMIN_ROLE. This allows the lifecycle contract
     *      to call trustedTransfer() to complete governed transfers.
     * @param _lifecycle Address of the deployed TransferLifecycle contract
     */
    function setLifecycleContract(address _lifecycle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lifecycleContract = _lifecycle;
        emit LifecycleContractSet(_lifecycle, block.timestamp);
    }

    // ──────────────────────────────────────────────
    //  Asset operations
    // ──────────────────────────────────────────────

    /**
     * @notice Mint a new governed asset record.
     * @dev Only an active Manager can mint. The custodian receives the token.
     *      New fields (physicalIdentifierHash, assetStateHash, metadataHash) default to 0x0
     *      and can be set later via attestAsset().
     * @param custodian              Address that will hold/receive the asset
     * @param tokenId                Unique token identifier
     * @param assetId                Human-readable asset identifier (e.g. "SEC-ASSET-A001")
     * @param name                   Human-readable asset name
     * @param description            Asset description / purpose
     * @param documentHash           SHA-256 hash of associated specification document (0x0 if none)
     */
    function mintAsset(
        address custodian,
        uint256 tokenId,
        string  calldata assetId,
        string  calldata name,
        string  calldata description,
        bytes32 documentHash
    ) external onlyActiveManager {
        if (custodian == address(0)) revert InvalidCustodian();

        // ERC721._mint reverts if tokenId already exists (duplicate protection)
        _mint(custodian, tokenId);

        assets[tokenId] = AssetData({
            assetId:                assetId,
            name:                   name,
            description:            description,
            documentHash:           documentHash,
            custodian:              custodian,
            createdBy:              msg.sender,
            createdAt:              block.timestamp,
            status:                 AssetState.REGISTERED,
            physicalIdentifierHash: bytes32(0),
            assetStateHash:         bytes32(0),
            metadataHash:           bytes32(0),
            lastAttestation:        0,
            attestedBy:             address(0)
        });

        totalAssets++;

        emit AssetMinted(tokenId, assetId, custodian, msg.sender, documentHash, block.timestamp);
    }

    /**
     * @notice Update the lifecycle state of an asset.
     * @dev Only active Managers can update state. Cannot change state of SUSPENDED/REVOKED assets
     *      (admin must unsuspend first).
     * @param tokenId   Token ID of the asset
     * @param newState  New lifecycle state
     */
    function updateAssetState(uint256 tokenId, AssetState newState) external onlyActiveManager {
        _requireOwned(tokenId);
        AssetState current = assets[tokenId].status;
        if (current == AssetState.SUSPENDED || current == AssetState.REVOKED) {
            revert AssetSuspendedOrRevoked();
        }

        assets[tokenId].status = newState;
        emit AssetStateChanged(tokenId, current, newState, msg.sender, block.timestamp);
    }

    /**
     * @notice Record a physical-digital attestation for an asset.
     * @dev The attestation records cryptographic hashes that link the digital asset record
     *      to a submitted physical identifier and state snapshot.
     *      IMPORTANT: This records a tamper-evident binding, NOT a guarantee that the
     *      physical asset is authentic — that requires off-chain verification of the
     *      physical identifier itself.
     * @param tokenId                Token ID of the asset
     * @param physicalIdentifierHash Hash of physical identifier (e.g. serial number)
     * @param stateHash              Hash of the canonicalized state record
     * @param metadataHash           Hash of off-chain metadata blob (0x0 if none)
     */
    function attestAsset(
        uint256 tokenId,
        bytes32 physicalIdentifierHash,
        bytes32 stateHash,
        bytes32 metadataHash
    ) external onlyActiveManager {
        _requireOwned(tokenId);
        if (assets[tokenId].status == AssetState.REVOKED) revert AssetSuspendedOrRevoked();

        assets[tokenId].physicalIdentifierHash = physicalIdentifierHash;
        assets[tokenId].assetStateHash         = stateHash;
        assets[tokenId].metadataHash           = metadataHash;
        assets[tokenId].lastAttestation        = block.timestamp;
        assets[tokenId].attestedBy             = msg.sender;

        emit AssetAttested(tokenId, physicalIdentifierHash, stateHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Transfer custody of a governed asset to a new custodian.
     * @dev Only an active Manager can transfer custody. The current custodian
     *      does NOT have the right to transfer — this is deliberate.
     *      This represents controlled organizational custody, not consumer NFT transfer.
     * @param newCustodian Address of the new custodian
     * @param tokenId      Token ID of the asset to transfer
     */
    function custodyTransfer(
        address newCustodian,
        uint256 tokenId
    ) external onlyActiveManager {
        if (newCustodian == address(0)) revert InvalidCustodian();

        AssetState current = assets[tokenId].status;
        if (current == AssetState.SUSPENDED || current == AssetState.REVOKED) {
            revert AssetSuspendedOrRevoked();
        }

        address currentCustodian = ownerOf(tokenId);
        _transfer(currentCustodian, newCustodian, tokenId);
        assets[tokenId].custodian = newCustodian;
        assets[tokenId].status    = AssetState.TRANSFERRED;

        emit AssetCustodyTransferred(tokenId, currentCustodian, newCustodian, msg.sender, block.timestamp);
        emit AssetStateChanged(tokenId, current, AssetState.TRANSFERRED, msg.sender, block.timestamp);
    }

    /**
     * @notice Execute a trust-continuity-governed transfer.
     * @dev Only callable by the authorized TransferLifecycle contract after all
     *      lifecycle validation steps have passed. This is the final execution
     *      step of the full transfer lifecycle.
     * @param newCustodian Address of the new custodian
     * @param tokenId      Token ID of the asset to transfer
     */
    function trustedTransfer(
        address newCustodian,
        uint256 tokenId
    ) external onlyLifecycle {
        if (newCustodian == address(0)) revert InvalidCustodian();

        address currentCustodian = ownerOf(tokenId);
        _transfer(currentCustodian, newCustodian, tokenId);
        assets[tokenId].custodian = newCustodian;
        assets[tokenId].status    = AssetState.TRANSFERRED;

        emit AssetCustodyTransferred(tokenId, currentCustodian, newCustodian, msg.sender, block.timestamp);
        emit AssetStateChanged(tokenId, AssetState.TRANSFER_PENDING, AssetState.TRANSFERRED, msg.sender, block.timestamp);
    }

    /**
     * @notice Suspend an asset (temporarily block all operations on it).
     * @dev Only DEFAULT_ADMIN_ROLE. Reduces unauthorized state transitions.
     *      Smart-contract authorization and immutable audit records improve accountability.
     * @param tokenId Token ID to suspend
     */
    function suspendAsset(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _requireOwned(tokenId);
        AssetState prev = assets[tokenId].status;
        assets[tokenId].status = AssetState.SUSPENDED;
        emit AssetSuspended(tokenId, msg.sender, block.timestamp);
        emit AssetStateChanged(tokenId, prev, AssetState.SUSPENDED, msg.sender, block.timestamp);
    }

    /**
     * @notice Unsuspend a previously suspended asset.
     * @param tokenId Token ID to unsuspend
     */
    function unsuspendAsset(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _requireOwned(tokenId);
        if (assets[tokenId].status != AssetState.SUSPENDED) revert AssetNotInAllowedState(assets[tokenId].status, AssetState.SUSPENDED);
        assets[tokenId].status = AssetState.REGISTERED;
        emit AssetStateChanged(tokenId, AssetState.SUSPENDED, AssetState.REGISTERED, msg.sender, block.timestamp);
    }

    /**
     * @notice Permanently revoke/decommission an asset.
     * @dev Only DEFAULT_ADMIN_ROLE. This is irreversible for demo purposes.
     * @param tokenId Token ID to revoke
     */
    function revokeAsset(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _requireOwned(tokenId);
        AssetState prev = assets[tokenId].status;
        assets[tokenId].status = AssetState.REVOKED;
        emit AssetRevoked(tokenId, msg.sender, block.timestamp);
        emit AssetStateChanged(tokenId, prev, AssetState.REVOKED, msg.sender, block.timestamp);
    }

    /**
     * @notice Get the current lifecycle state of an asset.
     * @param tokenId Token ID to query
     */
    function getAssetState(uint256 tokenId) external view returns (AssetState) {
        _requireOwned(tokenId);
        return assets[tokenId].status;
    }

    /**
     * @notice Verify the integrity of an asset's associated specification document.
     * @param tokenId Token ID of the asset
     * @param hash    SHA-256 hash to compare against stored hash
     * @return matches    True if the provided hash matches the stored hash
     * @return storedHash The hash stored on-chain
     */
    function verifyIntegrity(
        uint256 tokenId,
        bytes32 hash
    ) external view returns (bool matches, bytes32 storedHash) {
        _requireOwned(tokenId);
        storedHash = assets[tokenId].documentHash;
        matches = (storedHash != bytes32(0)) && (hash == storedHash);
    }

    // ──────────────────────────────────────────────
    //  Disable standard ERC-721 transfers
    //  Custody changes ONLY through custodyTransfer() or trustedTransfer()
    // ──────────────────────────────────────────────

    function transferFrom(address, address, uint256) public pure override {
        revert DirectTransferDisabled();
    }

    function approve(address, uint256) public pure override {
        revert DirectTransferDisabled();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert DirectTransferDisabled();
    }

    // ──────────────────────────────────────────────
    //  Last-admin protection
    // ──────────────────────────────────────────────

    function _grantRole(bytes32 role, address account) internal override returns (bool) {
        bool granted = super._grantRole(role, account);
        if (granted && role == DEFAULT_ADMIN_ROLE) {
            _adminCount++;
        }
        return granted;
    }

    function _revokeRole(bytes32 role, address account) internal override returns (bool) {
        if (role == DEFAULT_ADMIN_ROLE && _adminCount <= 1) {
            revert CannotRemoveLastAdmin();
        }
        bool revoked = super._revokeRole(role, account);
        if (revoked && role == DEFAULT_ADMIN_ROLE) {
            _adminCount--;
        }
        return revoked;
    }

    // ──────────────────────────────────────────────
    //  Required overrides
    // ──────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
