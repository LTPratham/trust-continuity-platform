# Trust Continuity Platform — System Architecture
## SIH26125 — Bharat Electronics Limited (BEL)

### 1. High-Level Architectural Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                            │
│                                                                         │
│     Next.js Enterprise Web Dashboard (TypeScript + Tailwind CSS)        │
│     ├── /           — Live Metrics & Dynamic Trust Chain Diagram        │
│     ├── /identities — Organizational Identity & Access Registry         │
│     ├── /assets     — Governed Asset Management & SHA-256 Verifier      │
│     ├── /audit      — Immutable Evidence Ledger (Live Event Logs)       │
│     └── /security   — Live Attack Scenario Demonstrations               │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ ethers.js v6
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SIGNER & IDENTITY BOUNDARY                       │
│                                                                         │
│   [PRIMARY] MetaMask Web3 Wallet  ───► Signs transactions via window.eth│
│   [DEV ONLY] Hardhat Demo Wallets ───► Fast presentation account switch │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ JSON-RPC (HTTP / WebSocket)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SMART CONTRACT AUTHORIZATION LAYER                   │
│                     (The Sole Authorization Authority)                   │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     IdentityRegistry.sol                        │   │
│   │                                                                 │   │
│   │   • Identities Mapping: address => struct Identity {reg, act}   │   │
│   │   • registerIdentity(address)  [onlyAdmin]                      │   │
│   │   • revokeIdentity(address)    [onlyAdmin, CannotRevokeSelf]    │   │
│   │   • reactivateIdentity(address)[onlyAdmin]                      │   │
│   │   • isActive(address) -> bool                                   │   │
│   │   • isRegistered(address) -> bool                               │   │
│   │   • Events: IdentityRegistered, IdentityRevoked, Reactivated    │   │
│   └────────────────────────────────┬────────────────────────────────┘   │
│                                    │ Cross-contract view call           │
│                                    │ identityRegistry.isActive(caller)  │
│                                    ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                         AssetNFT.sol                            │   │
│   │               (ERC-721 + OpenZeppelin AccessControl)            │   │
│   │                                                                 │   │
│   │   • Roles: DEFAULT_ADMIN_ROLE, MANAGER_ROLE, AUDITOR_ROLE,      │   │
│   │            USER_ROLE                                            │   │
│   │   • modifier onlyActiveManager():                               │   │
│   │       require(hasRole(MANAGER_ROLE, msg.sender))                │   │
│   │       require(identityRegistry.isActive(msg.sender))            │   │
│   │                                                                 │   │
│   │   • mintAsset(custodian, tokenId, assetId, name, desc, hash)    │   │
│   │   • custodyTransfer(newCustodian, tokenId)                      │   │
│   │   • verifyIntegrity(tokenId, docHash) -> (bool, bytes32)        │   │
│   │                                                                 │   │
│   │   [DISABLED FOR GOVERNANCE]:                                    │   │
│   │   • transferFrom()       -> REVERT DirectTransferDisabled()     │   │
│   │   • approve()            -> REVERT DirectTransferDisabled()     │   │
│   │   • setApprovalForAll()  -> REVERT DirectTransferDisabled()     │   │
│   │                                                                 │   │
│   │   [LAST-ADMIN SAFETY]:                                          │   │
│   │   • _revokeRole() checks adminCount > 1                         │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ State transition & Logs
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    IMMUTABLE EVENT & EVIDENCE LEDGER                    │
│                                                                         │
│   Events emitted:                                                       │
│   • IdentityRegistered(address, timestamp)                              │
│   • IdentityRevoked(address, timestamp)                                 │
│   • IdentityReactivated(address, timestamp)                             │
│   • RoleGranted(role, account, sender)                                  │
│   • RoleRevoked(role, account, sender)                                  │
│   • AssetMinted(tokenId, assetId, custodian, createdBy, docHash, time)   │
│   • AssetCustodyTransferred(tokenId, from, to, transferredBy, time)     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 2. The Five-Node Continuous Trust Chain

```
   ┌─────────────────┐
   │ 1. WHO IS       │  Identity Registry: Verifies if wallet identity
   │    ACTING?      │  is officially registered and in ACTIVE status.
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ 2. WHAT ARE     │  Role-Based Access Control: Verifies whether
   │    THEY ALLOWED │  account holds required role (MANAGER_ROLE).
   │    TO DO?       │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ 3. WHICH ASSET  │  Asset Custody Layer: Governed ERC-721 token
   │    ARE THEY     │  represents unique record handle (BEL-TEST-1047).
   │    ACTING ON?   │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ 4. IS THE       │  Smart Contract Enforcement: EVM evaluates both
   │    ACTION       │  Role AND Identity. If either fails -> REVERT.
   │    ALLOWED?     │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ 5. CAN WE PROVE │  Event Evidence Trail: Blockchain log contains
   │    WHAT         │  actor, asset, timestamp, and transaction hash.
   │    HAPPENED?    │
   └─────────────────┘
```

---

### 3. Component Responsibility Matrix

| Component | Responsibility | Enforcement Mechanism |
|-----------|----------------|-----------------------|
| `IdentityRegistry.sol` | Maintains identity registration & active/revoked lifecycle | Single Admin modifier, last-admin self-revocation block |
| `AssetNFT.sol` | Governed asset registry, custody tracking, document hash integrity | `onlyActiveManager` modifier, disabled direct transfers |
| `AccessControl` (OZ) | Standardized granular permissions (Admin, Manager, Auditor, User) | Keccak256 role hashes, last-admin revoke block |
| Frontend Dashboard | Operator visualization, demo triggering, error translation | Communicates via JSON-RPC, translates reverts to plain English |
| MetaMask / Signer | Cryptographic non-repudiation of transactions | Secp256k1 ECDSA private key signature |
