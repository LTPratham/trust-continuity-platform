// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IdentityRegistry
 * @notice Blockchain-anchored identity status registry for the Trust Continuity Platform.
 * @dev Each wallet address can be registered, revoked, or reactivated by the admin.
 *      This is NOT a full W3C DID implementation — it is a simple identity registry
 *      designed so that a future DID layer can be added.
 *
 *      The admin (deployer) manages all identities. A revoked identity cannot perform
 *      privileged actions in linked contracts (e.g., AssetNFT), even if it still
 *      holds a role — the active check is the enforcement boundary.
 */
contract IdentityRegistry {
    // ──────────────────────────────────────────────
    //  Data structures
    // ──────────────────────────────────────────────

    struct Identity {
        bool registered;
        bool active;
    }

    /// @notice Identity status for each wallet address
    mapping(address => Identity) private identities;

    /// @notice The single administrator who manages identities
    address public admin;

    /// @notice Count of currently active identities
    uint256 public activeCount;

    /// @notice Count of currently revoked identities
    uint256 public revokedCount;

    /// @notice Total identities ever registered
    uint256 public totalRegistered;

    // ──────────────────────────────────────────────
    //  Custom errors (gas-efficient, clear meaning)
    // ──────────────────────────────────────────────

    /// @dev Caller is not the admin
    error NotAdmin();

    /// @dev Address is already registered
    error AlreadyRegistered();

    /// @dev Address is not registered
    error NotRegistered();

    /// @dev Identity is already active
    error AlreadyActive();

    /// @dev Identity is already inactive/revoked
    error AlreadyInactive();

    /// @dev Zero address is not allowed
    error ZeroAddress();

    /// @dev Admin cannot revoke their own identity (last-admin protection)
    error CannotRevokeSelf();

    // ──────────────────────────────────────────────
    //  Events (audit trail)
    // ──────────────────────────────────────────────

    /// @notice Emitted when a new identity is registered
    event IdentityRegistered(address indexed identity, uint256 timestamp);

    /// @notice Emitted when an identity is revoked
    event IdentityRevoked(address indexed identity, uint256 timestamp);

    /// @notice Emitted when a revoked identity is reactivated
    event IdentityReactivated(address indexed identity, uint256 timestamp);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    /// @dev Restricts function to the admin
    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @notice Deploys the registry with the caller as admin
    constructor() {
        admin = msg.sender;
    }

    // ──────────────────────────────────────────────
    //  Identity management
    // ──────────────────────────────────────────────

    /**
     * @notice Register a new identity. It becomes active immediately.
     * @param _identity The wallet address to register
     */
    function registerIdentity(address _identity) external onlyAdmin {
        if (_identity == address(0)) revert ZeroAddress();
        if (identities[_identity].registered) revert AlreadyRegistered();

        identities[_identity] = Identity({registered: true, active: true});
        activeCount++;
        totalRegistered++;

        emit IdentityRegistered(_identity, block.timestamp);
    }

    /**
     * @notice Revoke an active identity. It can no longer perform privileged actions.
     * @dev Admin cannot revoke their own identity (last-admin protection).
     *      Roles are NOT stripped — the isActive() check in linked contracts
     *      is the enforcement mechanism. This is a deliberate MVP decision.
     * @param _identity The wallet address to revoke
     */
    function revokeIdentity(address _identity) external onlyAdmin {
        if (_identity == address(0)) revert ZeroAddress();
        if (!identities[_identity].registered) revert NotRegistered();
        if (!identities[_identity].active) revert AlreadyInactive();
        if (_identity == admin) revert CannotRevokeSelf();

        identities[_identity].active = false;
        activeCount--;
        revokedCount++;

        emit IdentityRevoked(_identity, block.timestamp);
    }

    /**
     * @notice Reactivate a previously revoked identity.
     * @param _identity The wallet address to reactivate
     */
    function reactivateIdentity(address _identity) external onlyAdmin {
        if (_identity == address(0)) revert ZeroAddress();
        if (!identities[_identity].registered) revert NotRegistered();
        if (identities[_identity].active) revert AlreadyActive();

        identities[_identity].active = true;
        activeCount++;
        revokedCount--;

        emit IdentityReactivated(_identity, block.timestamp);
    }

    // ──────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────

    /**
     * @notice Check if an address has ever been registered
     * @param _identity The wallet address to check
     * @return True if registered (regardless of active status)
     */
    function isRegistered(address _identity) external view returns (bool) {
        return identities[_identity].registered;
    }

    /**
     * @notice Check if an address is registered AND currently active
     * @dev This is the function linked contracts (e.g., AssetNFT) use
     *      to enforce the identity-active requirement.
     * @param _identity The wallet address to check
     * @return True if registered and active
     */
    function isActive(address _identity) external view returns (bool) {
        return identities[_identity].registered && identities[_identity].active;
    }

    /**
     * @notice Get full identity status for an address
     * @param _identity The wallet address to query
     * @return registered Whether the address is registered
     * @return active Whether the address is currently active
     */
    function getIdentity(address _identity) external view returns (bool registered, bool active) {
        Identity memory id = identities[_identity];
        return (id.registered, id.active);
    }
}
