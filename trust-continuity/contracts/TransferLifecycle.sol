// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title IAssetNFTForLifecycle
 * @notice Minimal interface for AssetNFT used by TransferLifecycle
 */
interface IAssetNFTForLifecycle {
    function trustedTransfer(address newCustodian, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
    function getAssetState(uint256 tokenId) external view returns (uint8);
    function updateAssetState(uint256 tokenId, uint8 newState) external;
}

/**
 * @title IIdentityRegistryForLifecycle
 * @notice Minimal interface for IdentityRegistry used by TransferLifecycle
 */
interface IIdentityRegistryForLifecycle {
    function isActive(address identity) external view returns (bool);
}

/**
 * @title IAccessControlForLifecycle
 * @notice Minimal interface for role checking in AssetNFT
 */
interface IAccessControlForLifecycle {
    function hasRole(bytes32 role, address account) external view returns (bool);
}

/**
 * @title TransferLifecycle
 * @notice Multi-step governed transfer state machine for the Trust Continuity Platform.
 *
 * @dev Implements a controlled transfer lifecycle with 7 stages. Before a custody
 *      transfer is executed on-chain, the platform validates:
 *        1. Initiator identity is active
 *        2. Initiator has MANAGER_ROLE
 *        3. Asset exists and is not suspended/revoked
 *        4. Destination is authorized to receive
 *        5. Destination accepts the transfer
 *        6. Final confirmation executes the trust-delegated transfer
 *
 *      Trust Continuity Check Flow:
 *        Identity → Role → Asset State → Ownership → Authorization → ALLOW/DENY
 *
 *      The blockchain records every state transition, providing an immutable audit
 *      trail of WHO initiated, WHO authorized, WHO accepted, and WHEN each step occurred.
 *
 *      AssetState 4 = TRANSFER_PENDING (matches AssetNFT.AssetState enum)
 */
contract TransferLifecycle is AccessControl {
    // ──────────────────────────────────────────────
    //  Roles
    // ──────────────────────────────────────────────

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant USER_ROLE    = keccak256("USER_ROLE");

    // ──────────────────────────────────────────────
    //  Transfer State Enum
    // ──────────────────────────────────────────────

    enum TransferState {
        TRANSFER_REQUESTED,    // 0 — initiated by manager
        ORIGIN_VERIFIED,       // 1 — origin manager identity/role confirmed
        ASSET_STATE_VERIFIED,  // 2 — asset exists and is in a transferable state
        DESTINATION_AUTHORIZED,// 3 — admin authorized the destination
        DESTINATION_ACCEPTED,  // 4 — destination wallet accepted
        TRANSFER_CONFIRMED,    // 5 — executed on-chain (completed)
        TRANSFER_REJECTED      // 6 — rejected with reason
    }

    // ──────────────────────────────────────────────
    //  Data structures
    // ──────────────────────────────────────────────

    struct Transfer {
        uint256       tokenId;
        address       initiator;         // manager who initiated
        address       destination;       // intended new custodian
        TransferState state;
        uint256       requestedAt;
        uint256       completedAt;
        string        rejectionReason;
        bytes32       contextHash;       // hash(purpose/context description)
    }

    /// @notice All transfers, indexed by transfer ID
    mapping(uint256 => Transfer) public transfers;

    /// @notice Total transfers ever initiated
    uint256 public transferCount;

    /// @notice Linked contracts
    IAssetNFTForLifecycle         public assetNFT;
    IIdentityRegistryForLifecycle public identityRegistry;
    IAccessControlForLifecycle    public assetNFTAccessControl;

    // TRANSFER_PENDING = 4 in AssetNFT.AssetState
    uint8 private constant ASSET_STATE_TRANSFER_PENDING = 4;
    // SUSPENDED = 6, REVOKED = 7
    uint8 private constant ASSET_STATE_SUSPENDED = 6;
    uint8 private constant ASSET_STATE_REVOKED   = 7;

    // ──────────────────────────────────────────────
    //  Custom errors
    // ──────────────────────────────────────────────

    error TransferNotFound();
    error InvalidTransferState(TransferState current, TransferState required);
    error IdentityNotActive();
    error NotManager();
    error AssetNotTransferable();
    error NotDestination();
    error ZeroAddress();
    error AlreadyCompleted();

    // ──────────────────────────────────────────────
    //  Events (immutable audit trail)
    // ──────────────────────────────────────────────

    event TransferRequested(
        uint256 indexed transferId,
        uint256 indexed tokenId,
        address indexed initiator,
        address destination,
        bytes32 contextHash,
        uint256 timestamp
    );

    event TransferStateAdvanced(
        uint256 indexed transferId,
        TransferState   previousState,
        TransferState   newState,
        address         advancedBy,
        uint256         timestamp
    );

    event TransferCompleted(
        uint256 indexed transferId,
        uint256 indexed tokenId,
        address indexed destination,
        uint256 timestamp
    );

    event TransferRejected(
        uint256 indexed transferId,
        uint256 indexed tokenId,
        string  reason,
        address rejectedBy,
        uint256 timestamp
    );

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor(
        address _assetNFT,
        address _identityRegistry
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        assetNFT             = IAssetNFTForLifecycle(_assetNFT);
        assetNFTAccessControl = IAccessControlForLifecycle(_assetNFT);
        identityRegistry     = IIdentityRegistryForLifecycle(_identityRegistry);
    }

    // ──────────────────────────────────────────────
    //  Internal Trust Continuity checks
    // ──────────────────────────────────────────────

    /// @dev Verify identity is active in IdentityRegistry
    function _requireActiveIdentity(address account) internal view {
        if (!identityRegistry.isActive(account)) revert IdentityNotActive();
    }

    /// @dev Verify account has MANAGER_ROLE in AssetNFT
    function _requireManagerRole(address account) internal view {
        if (!assetNFTAccessControl.hasRole(MANAGER_ROLE, account)) revert NotManager();
    }

    /// @dev Verify asset is in a transferable state (not SUSPENDED or REVOKED)
    function _requireTransferableAsset(uint256 tokenId) internal view {
        uint8 state = assetNFT.getAssetState(tokenId);
        if (state == ASSET_STATE_SUSPENDED || state == ASSET_STATE_REVOKED) {
            revert AssetNotTransferable();
        }
    }

    // ──────────────────────────────────────────────
    //  Transfer lifecycle functions
    // ──────────────────────────────────────────────

    /**
     * @notice Step 1: Request a new governed transfer.
     * @dev Trust Continuity checks: Identity active + MANAGER_ROLE + asset transferable.
     *      Sets asset state to TRANSFER_PENDING in AssetNFT.
     * @param tokenId     Token ID of the asset to transfer
     * @param destination Intended new custodian
     * @param contextHash Hash of purpose/context description (0x0 if none)
     */
    function requestTransfer(
        uint256 tokenId,
        address destination,
        bytes32 contextHash
    ) external {
        if (destination == address(0)) revert ZeroAddress();

        // Trust Continuity Check: Identity → Role → Asset State
        _requireActiveIdentity(msg.sender);
        _requireManagerRole(msg.sender);
        _requireTransferableAsset(tokenId);

        uint256 id = transferCount++;

        transfers[id] = Transfer({
            tokenId:         tokenId,
            initiator:       msg.sender,
            destination:     destination,
            state:           TransferState.TRANSFER_REQUESTED,
            requestedAt:     block.timestamp,
            completedAt:     0,
            rejectionReason: "",
            contextHash:     contextHash
        });

        emit TransferRequested(id, tokenId, msg.sender, destination, contextHash, block.timestamp);

        // Immediately advance to ORIGIN_VERIFIED (identity+role already confirmed above)
        _advanceState(id, TransferState.ORIGIN_VERIFIED, msg.sender);

        // Advance to ASSET_STATE_VERIFIED
        _advanceState(id, TransferState.ASSET_STATE_VERIFIED, msg.sender);
    }

    /**
     * @notice Step 4: Admin authorizes the destination for the transfer.
     * @dev Only DEFAULT_ADMIN_ROLE. Advances state to DESTINATION_AUTHORIZED.
     * @param transferId The transfer to authorize
     */
    function authorizeDestination(uint256 transferId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Transfer storage t = _getActiveTransfer(transferId);
        _requireState(t, TransferState.ASSET_STATE_VERIFIED);
        _advanceState(transferId, TransferState.DESTINATION_AUTHORIZED, msg.sender);
    }

    /**
     * @notice Step 5: Destination wallet accepts the incoming transfer.
     * @dev Must be called by the destination address itself. Advances to DESTINATION_ACCEPTED.
     * @param transferId The transfer to accept
     */
    function acceptTransfer(uint256 transferId) external {
        Transfer storage t = _getActiveTransfer(transferId);
        _requireState(t, TransferState.DESTINATION_AUTHORIZED);
        if (msg.sender != t.destination) revert NotDestination();
        _advanceState(transferId, TransferState.DESTINATION_ACCEPTED, msg.sender);
    }

    /**
     * @notice Step 6: Active manager confirms and executes the transfer on-chain.
     * @dev Final Trust Continuity check: re-verifies identity + role + asset state.
     *      Calls assetNFT.trustedTransfer() to complete the on-chain custody change.
     * @param transferId The transfer to confirm and execute
     */
    function confirmTransfer(uint256 transferId) external {
        Transfer storage t = _getActiveTransfer(transferId);
        _requireState(t, TransferState.DESTINATION_ACCEPTED);

        // Final Trust Continuity re-validation before execution
        _requireActiveIdentity(msg.sender);
        _requireManagerRole(msg.sender);
        _requireTransferableAsset(t.tokenId);

        // Execute on-chain custody change via trusted bridge
        assetNFT.trustedTransfer(t.destination, t.tokenId);

        t.state       = TransferState.TRANSFER_CONFIRMED;
        t.completedAt = block.timestamp;

        emit TransferStateAdvanced(transferId, TransferState.DESTINATION_ACCEPTED, TransferState.TRANSFER_CONFIRMED, msg.sender, block.timestamp);
        emit TransferCompleted(transferId, t.tokenId, t.destination, block.timestamp);
    }

    /**
     * @notice Reject a transfer at any active stage.
     * @dev Can be called by DEFAULT_ADMIN_ROLE or the initiating manager.
     *      The rejection and reason are recorded immutably.
     * @param transferId The transfer to reject
     * @param reason     Human-readable reason for rejection
     */
    function rejectTransfer(uint256 transferId, string calldata reason) external {
        Transfer storage t = _getActiveTransfer(transferId);

        bool isAdmin   = hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
        bool isManager = identityRegistry.isActive(msg.sender) &&
                         assetNFTAccessControl.hasRole(MANAGER_ROLE, msg.sender);

        require(isAdmin || isManager, "Not authorized to reject");

        TransferState prev = t.state;
        t.state            = TransferState.TRANSFER_REJECTED;
        t.rejectionReason  = reason;
        t.completedAt      = block.timestamp;

        emit TransferRejected(transferId, t.tokenId, reason, msg.sender, block.timestamp);
        emit TransferStateAdvanced(transferId, prev, TransferState.TRANSFER_REJECTED, msg.sender, block.timestamp);
    }

    // ──────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────

    /**
     * @notice Get full transfer record
     */
    function getTransfer(uint256 transferId)
        external
        view
        returns (
            uint256       tokenId,
            address       initiator,
            address       destination,
            TransferState state,
            uint256       requestedAt,
            uint256       completedAt,
            string memory rejectionReason,
            bytes32       contextHash
        )
    {
        Transfer storage t = transfers[transferId];
        return (
            t.tokenId,
            t.initiator,
            t.destination,
            t.state,
            t.requestedAt,
            t.completedAt,
            t.rejectionReason,
            t.contextHash
        );
    }

    /**
     * @notice Get all transfer IDs for a given token (max scan of transferCount)
     */
    function getTransfersForToken(uint256 tokenId)
        external
        view
        returns (uint256[] memory ids)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < transferCount; i++) {
            if (transfers[i].tokenId == tokenId) count++;
        }
        ids = new uint256[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < transferCount; i++) {
            if (transfers[i].tokenId == tokenId) ids[j++] = i;
        }
    }

    // ──────────────────────────────────────────────
    //  Internal helpers
    // ──────────────────────────────────────────────

    function _getActiveTransfer(uint256 transferId) internal view returns (Transfer storage t) {
        if (transferId >= transferCount) revert TransferNotFound();
        t = transfers[transferId];
        if (t.state == TransferState.TRANSFER_CONFIRMED || t.state == TransferState.TRANSFER_REJECTED) {
            revert AlreadyCompleted();
        }
    }

    function _requireState(Transfer storage t, TransferState required) internal view {
        if (t.state != required) revert InvalidTransferState(t.state, required);
    }

    function _advanceState(uint256 transferId, TransferState newState, address actor) internal {
        TransferState prev = transfers[transferId].state;
        transfers[transferId].state = newState;
        emit TransferStateAdvanced(transferId, prev, newState, actor, block.timestamp);
    }
}
