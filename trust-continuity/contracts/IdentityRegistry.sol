// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IdentityRegistry
 * @notice Blockchain-anchored Organizational Identity Registry for the Trust Continuity Platform.
 * @dev Each wallet address can be registered, revoked, or reactivated by the admin.
 *      This is a "Blockchain-backed Organizational Identity Registry" — not a full W3C DID
 *      implementation, though it stores a credential hash that can reference an off-chain
 *      verifiable credential or DID document. A full DID layer can be added in future.
 *
 *      The admin manages all identities. A revoked identity cannot perform
 *      privileged actions in linked contracts (e.g., AssetNFT, TransferLifecycle),
 *      even if it still holds a role — the isActive() check is the enforcement boundary.
 *
 *      On-chain storage principle:
 *        - Only hashes, status flags, and timestamps are stored on-chain.
 *        - Sensitive personal/organizational information stays off-chain.
 *        - credentialHash = hash(off-chain credential or DID document reference).
 */
contract IdentityRegistry {
    // ──────────────────────────────────────────────
    //  Data structures
    // ──────────────────────────────────────────────

    struct Identity {
        bool registered;
        bool active;
        bytes32 credentialHash;  // hash of off-chain credential/DID reference (0x0 if none)
        uint256 registeredAt;    // block timestamp of registration
        string  label;           // human-readable label (e.g. role/department, NOT personal data)
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
    //  Custom errors
    // ──────────────────────────────────────────────

    error NotAdmin();
    error AlreadyRegistered();
    error NotRegistered();
    error AlreadyActive();
    error AlreadyInactive();
    error ZeroAddress();

    /// @dev Admin cannot revoke their own identity (last-admin protection)
    error CannotRevokeSelf();

    // ──────────────────────────────────────────────
    //  Events (immutable audit trail)
    // ──────────────────────────────────────────────

    /// @notice Emitted when a new identity is registered
    event IdentityRegistered(address indexed identity, string label, bytes32 credentialHash, uint256 timestamp);

    /// @notice Emitted when an identity is revoked
    event IdentityRevoked(address indexed identity, uint256 timestamp);

    /// @notice Emitted when a revoked identity is reactivated
    event IdentityReactivated(address indexed identity, uint256 timestamp);

    /// @notice Emitted when a credential hash is updated
    event CredentialUpdated(address indexed identity, bytes32 newCredentialHash, uint256 timestamp);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

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
     * @param _label Human-readable label (role/department reference — no personal data)
     * @param _credentialHash Hash of off-chain credential or DID document (0x0 if none)
     */
    function registerIdentity(
        address _identity,
        string calldata _label,
        bytes32 _credentialHash
    ) external onlyAdmin {
        if (_identity == address(0)) revert ZeroAddress();
        if (identities[_identity].registered) revert AlreadyRegistered();

        identities[_identity] = Identity({
            registered: true,
            active: true,
            credentialHash: _credentialHash,
            registeredAt: block.timestamp,
            label: _label
        });
        activeCount++;
        totalRegistered++;

        emit IdentityRegistered(_identity, _label, _credentialHash, block.timestamp);
    }

    /**
     * @notice Revoke an active identity. It can no longer perform privileged actions.
     * @dev Admin cannot revoke their own identity (last-admin protection).
     *      Roles in linked contracts are NOT stripped — the isActive() check is
     *      the enforcement mechanism. This is a deliberate architectural decision:
     *      role records remain as audit evidence, but the active flag blocks execution.
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

    /**
     * @notice Update the credential hash for a registered identity.
     * @dev Use when off-chain credential is renewed or updated.
     *      Only the hash is stored on-chain; the credential itself stays off-chain.
     * @param _identity The wallet address to update
     * @param _credentialHash New hash of off-chain credential/DID document
     */
    function updateCredential(address _identity, bytes32 _credentialHash) external onlyAdmin {
        if (!identities[_identity].registered) revert NotRegistered();
        identities[_identity].credentialHash = _credentialHash;
        emit CredentialUpdated(_identity, _credentialHash, block.timestamp);
    }

    // ──────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────

    /**
     * @notice Check if an address has ever been registered
     */
    function isRegistered(address _identity) external view returns (bool) {
        return identities[_identity].registered;
    }

    /**
     * @notice Check if an address is registered AND currently active.
     * @dev This is the primary enforcement function used by linked contracts.
     */
    function isActive(address _identity) external view returns (bool) {
        return identities[_identity].registered && identities[_identity].active;
    }

    /**
     * @notice Get full identity record for an address
     */
    function getIdentity(address _identity)
        external
        view
        returns (
            bool registered,
            bool active,
            bytes32 credentialHash,
            uint256 registeredAt,
            string memory label
        )
    {
        Identity memory id = identities[_identity];
        return (id.registered, id.active, id.credentialHash, id.registeredAt, id.label);
    }
}
