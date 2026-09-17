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
 * @dev Each token is a unique digital record / control handle for a governed asset.
 *      The token does NOT mean the physical asset "exists on the blockchain" —
 *      it represents the unique asset record and custody state.
 *
 *      Authorization requires BOTH:
 *        1. Correct role (e.g., MANAGER_ROLE)
 *        2. Active identity in IdentityRegistry
 *
 *      Standard ERC-721 transfers (transferFrom, safeTransferFrom) are DISABLED.
 *      Custody changes ONLY happen through custodyTransfer(), enforced by the contract.
 *
 *      Roles:
 *        - DEFAULT_ADMIN_ROLE: Grant/revoke roles, platform administration
 *        - MANAGER_ROLE: Mint assets, transfer custody
 *        - AUDITOR_ROLE: View-only (no state-modifying privileges)
 *        - USER_ROLE: Can hold/receive assets (no manager operations)
 */
contract AssetNFT is ERC721, AccessControl {
    // ──────────────────────────────────────────────
    //  Role definitions
    // ──────────────────────────────────────────────

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant USER_ROLE = keccak256("USER_ROLE");

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice Reference to the IdentityRegistry for active-identity checks
    IIdentityRegistry public identityRegistry;

    /// @notice Asset metadata stored on-chain per token
    struct AssetData {
        string assetId;       // e.g., "BEL-TEST-1047"
        string name;          // Human-readable asset name
        string description;   // Asset description
        bytes32 documentHash; // SHA-256 hash of associated document (integrity check)
        address custodian;    // Current custodian of the asset
        address createdBy;    // Manager who minted the asset
        uint256 createdAt;    // Block timestamp when minted
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

    /// @dev Caller's identity is not active in IdentityRegistry
    error IdentityNotActive();

    /// @dev Caller does not have MANAGER_ROLE
    error NotManager();

    /// @dev Referenced asset/token does not exist
    error AssetDoesNotExist();

    /// @dev Custodian address is invalid (zero address)
    error InvalidCustodian();

    /// @dev Cannot remove the last DEFAULT_ADMIN_ROLE holder
    error CannotRemoveLastAdmin();

    /// @dev Direct ERC-721 transfers are disabled; use custodyTransfer
    error DirectTransferDisabled();

    // ──────────────────────────────────────────────
    //  Events (audit trail)
    // ──────────────────────────────────────────────

    /// @notice Emitted when a new asset is minted
    event AssetMinted(
        uint256 indexed tokenId,
        string assetId,
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

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    /**
     * @dev Requires the caller to have MANAGER_ROLE AND an active identity.
     *      This is the critical dual-check: role alone is insufficient.
     */
    modifier onlyActiveManager() {
        if (!hasRole(MANAGER_ROLE, msg.sender)) revert NotManager();
        if (!identityRegistry.isActive(msg.sender)) revert IdentityNotActive();
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
        // _adminCount is incremented to 1 by the _grantRole override
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    // ──────────────────────────────────────────────
    //  Asset operations
    // ──────────────────────────────────────────────

    /**
     * @notice Mint a new governed asset record
     * @dev Only an active Manager can mint. The custodian receives the token.
     * @param custodian Address that will hold/receive the asset
     * @param tokenId Unique token identifier
     * @param assetId Human-readable asset identifier (e.g., "BEL-TEST-1047")
     * @param name Human-readable asset name
     * @param description Asset description
     * @param documentHash SHA-256 hash of associated document (0x0 if none)
     */
    function mintAsset(
        address custodian,
        uint256 tokenId,
        string calldata assetId,
        string calldata name,
        string calldata description,
        bytes32 documentHash
    ) external onlyActiveManager {
        if (custodian == address(0)) revert InvalidCustodian();

        // ERC721._mint reverts if tokenId already exists (duplicate protection)
        _mint(custodian, tokenId);

        assets[tokenId] = AssetData({
            assetId: assetId,
            name: name,
            description: description,
            documentHash: documentHash,
            custodian: custodian,
            createdBy: msg.sender,
            createdAt: block.timestamp
        });

        totalAssets++;

        emit AssetMinted(tokenId, assetId, custodian, msg.sender, documentHash, block.timestamp);
    }

    /**
     * @notice Transfer custody of a governed asset to a new custodian
     * @dev Only an active Manager can transfer custody. The current custodian
     *      does NOT have the right to transfer — this is deliberate.
     *      This represents controlled organizational custody, not consumer NFT ownership.
     * @param newCustodian Address of the new custodian
     * @param tokenId Token ID of the asset to transfer
     */
    function custodyTransfer(
        address newCustodian,
        uint256 tokenId
    ) external onlyActiveManager {
        if (newCustodian == address(0)) revert InvalidCustodian();

        // ownerOf reverts for non-existent tokens (ERC721 built-in check)
        address currentCustodian = ownerOf(tokenId);

        // Internal transfer bypasses approval checks — governance action
        _transfer(currentCustodian, newCustodian, tokenId);

        // Update custodian in asset metadata
        assets[tokenId].custodian = newCustodian;

        emit AssetCustodyTransferred(
            tokenId,
            currentCustodian,
            newCustodian,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Verify the integrity of an asset's associated document
     * @param tokenId Token ID of the asset
     * @param hash SHA-256 hash to compare against stored hash
     * @return matches True if the provided hash matches the stored hash
     * @return storedHash The hash stored on-chain
     */
    function verifyIntegrity(
        uint256 tokenId,
        bytes32 hash
    ) external view returns (bool matches, bytes32 storedHash) {
        // Check asset exists
        _requireOwned(tokenId);
        storedHash = assets[tokenId].documentHash;
        matches = (storedHash != bytes32(0)) && (hash == storedHash);
    }

    // ──────────────────────────────────────────────
    //  Disable standard ERC-721 transfers
    //  Custody changes ONLY through custodyTransfer()
    // ──────────────────────────────────────────────

    /// @dev Disabled — governed assets use custodyTransfer only
    function transferFrom(address, address, uint256) public pure override {
        revert DirectTransferDisabled();
    }

    /// @dev Disabled — governed assets cannot be approved for direct transfer
    function approve(address, uint256) public pure override {
        revert DirectTransferDisabled();
    }

    /// @dev Disabled — governed assets cannot be approved for direct transfer
    function setApprovalForAll(address, bool) public pure override {
        revert DirectTransferDisabled();
    }

    // ──────────────────────────────────────────────
    //  Last-admin protection
    // ──────────────────────────────────────────────

    /**
     * @dev Override _grantRole to track admin count
     */
    function _grantRole(bytes32 role, address account) internal override returns (bool) {
        bool granted = super._grantRole(role, account);
        if (granted && role == DEFAULT_ADMIN_ROLE) {
            _adminCount++;
        }
        return granted;
    }

    /**
     * @dev Override _revokeRole to prevent removing the last admin
     */
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

    /// @dev Required override for ERC721 + AccessControl
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
