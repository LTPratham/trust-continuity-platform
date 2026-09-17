# Trust Continuity Platform — Build Report
## SIH26125 — Bharat Electronics Limited (BEL)

---

### 1. Project Overview

Imagine a defense and aerospace enterprise like Bharat Electronics Limited (BEL) managing classified hardware modules, test benches, radar systems, and digital records across hundreds of engineers and departments. 

The organization must guarantee:
- Exactly **WHO** is performing an action,
- **WHAT** specific permissions that individual possesses,
- **WHICH** governed asset or equipment they are touching,
- Whether the requested action is **PERMITTED BY POLICY**, and
- Whether a permanent, mathematical **PROOF** of that action exists that no single disgruntled administrator can silently delete or rewrite in a database.

The **Trust Continuity Platform** connects organizational identity, granular access permissions, asset custody, smart-contract policy enforcement, and tamper-evident event logging into one continuous, unbreakable trust chain.

---

### 2. Problem We Are Solving

Modern enterprise IT and defense operations face five fundamental vulnerabilities:

1. **The Identity Problem**: When an employee leaves or is reassigned, traditional enterprise Single Sign-On (SSO) or database accounts often leave orphaned or lingering credentials. Revocation in one system does not propagate instantly to operational tools.
2. **The Stale Permission Problem**: Role-Based Access Control (RBAC) in centralized databases often dissociates the user's employment status from their active privileges. An inactive employee may still retain an administrative role token.
3. **The Asset Custody Problem**: In consumer blockchain tokens (NFTs), any token holder can transfer or trade their token. In defense manufacturing, possession of an asset does not grant permission to reassign or surrender that asset — custody transfer is strictly a governance action.
4. **The Centralized Database Trust Problem**: When all logs and permissions live in an administrative database (e.g., PostgreSQL), a compromised database administrator (DBA) or root intrusion can run `UPDATE assets SET custodian = ...` or `DELETE FROM audit_logs WHERE ...` without leaving an external trace.
5. **The Frontend Bypass Problem**: In standard web applications, authorization checks frequently live in UI code or backend APIs. If an attacker bypasses the frontend or intercepts the API, unauthorized state modifications occur unchecked.

---

### 3. Our Core Idea

The core innovation is **NOT** "blockchain" in isolation, **NOT** "NFTs", and **NOT** "AI". 

The innovation is the **Continuous Trust Chain**:

```
WHO IS ACTING? (Identity Registry)
        ↓
WHAT ARE THEY ALLOWED TO DO? (Role Permission)
        ↓
WHICH ASSET ARE THEY ACTING ON? (Governed Asset Handle)
        ↓
IS THE ACTION ALLOWED? (Smart Contract Dual-Check)
        ↓
CAN WE PROVE WHAT HAPPENED? (Immutable Event Ledger)
```

Both conditions must be simultaneously satisfied:
$$\text{Authorized Action} = \text{Valid Role} \land \text{Active Identity}$$

If an identity is revoked, privileged actions are rejected on-chain immediately, even if the account still holds the role.

---

### 4. System Architecture

```
User (Browser)
      ↓
MetaMask / Signer
      ↓
Next.js Governance Dashboard
      ↓
Solidity Smart Contracts (Local Hardhat Node)
   ├── IdentityRegistry.sol (Identity Status & Revocation)
   └── AssetNFT.sol (ERC-721 Custody & AccessControl)
      ↓
Immutable Event Logs (Audit Evidence Trail)
```

Each component has a clear, non-redundant purpose:
- **MetaMask / Signer**: Provides cryptographic non-repudiation (secp256k1 signature).
- **Next.js UI**: Provides human-readable enterprise management and real-time error translation.
- **IdentityRegistry.sol**: Controls organizational registration, revocation, and reactivation status.
- **AssetNFT.sol**: Maintains unique governed asset records, custody assignment, and document integrity hashes.
- **Solidity Smart Contracts**: Serve as the sole authorization authority.

---

### 5. Component-by-Component Explanation

| Component | What it Does | Why We Built It | What Problem it Solves |
|-----------|--------------|-----------------|------------------------|
| `IdentityRegistry.sol` | Tracks whether a wallet is registered and active | Anchors organizational employee status on-chain | Prevents unauthorized or departed personnel from acting |
| `AccessControl.sol` (OpenZeppelin) | Assigns roles (ADMIN, MANAGER, AUDITOR, USER) | Implements standardized, battle-tested RBAC | Eliminates arbitrary custom role logic bugs |
| `AssetNFT.sol` | Issues unique token handles for governed assets | Provides unique identification and custody state | Prevents duplicate, forged, or unrecorded asset records |
| `onlyActiveManager` Modifier | Dual-checks `hasRole()` and `identityRegistry.isActive()` | Forces cross-contract verification before execution | Solves stale role exploits and bypasses |
| Disabled Direct Transfers | Reverts `transferFrom()` and `approve()` | Prevents unilateral asset transfer by holders | Replaces consumer token trading with controlled organizational custody |
| SHA-256 Integrity Verifier | Compares off-chain document hash to on-chain hash | Stores mathematical proof without leaking secrets | Detects tampering with technical documentation or blueprints |
| Blockchain Event Logs | Emits indexed logs on every lifecycle state change | Creates an immutable, append-only history | Prevents silent history rewriting by administrators |
| Next.js Dashboard | Provides intuitive UI with plain-language explanations | Enables non-blockchain judges to inspect live state | Removes confusing Web3 jargon from evaluation |

---

### 6. Why Blockchain?

We do not use blockchain because it is trendy. We use blockchain because of a specific technical property:

> **A shared, append-only state machine where state transitions require cryptographically signed transactions evaluated by immutable smart contracts, making silent historical rewriting impractical.**

In a standard PostgreSQL database, an administrator with database root access can silently change custody or delete audit records:
```sql
-- In a database, an admin can silently alter history:
UPDATE assets SET custodian = '0xAttacker' WHERE token_id = 1047;
DELETE FROM logs WHERE actor = '0xAttacker';
```
In the Trust Continuity Platform, changing custody requires a signed transaction from an active manager, passes through `custodyTransfer()`, and emits `AssetCustodyTransferred` into the block receipts. An administrator cannot rewrite the historical log without breaking the cryptographic hash chain of the blocks.

We do **not** claim blockchain is "impossible to hack" or "guarantees 100% security." We claim it provides **mathematical evidence and non-repudiable state enforcement**.

---

### 7. Why NFT / ERC-721?

We are **not** building a cryptocurrency or a marketplace.

In defense engineering, each physical transceiver, radar subsystem, or test bench is a distinct, physical entity with an individual serial number (e.g., `BEL-TEST-1047`). Fungible tokens (ERC-20) represent interchangeable currency, which does not model individual assets.

ERC-721 provides:
- A globally unique numeric `tokenId`.
- An explicit, verifiable current custodian (`ownerOf(tokenId)`).
- A natural handle to attach metadata (Asset Code, Name, Description, SHA-256 Document Hash).

**Critical Modification**: Standard ERC-721 allows token owners to transfer tokens at will. We disabled `transferFrom`, `approve`, and `setApprovalForAll`. Custody changes can **only** occur through `custodyTransfer()`, authorized by a verified manager.

---

### 8. Why Smart Contracts?

In conventional architectures:
```python
# Vulnerable traditional backend:
if user.role == "manager":
    transfer_asset(asset_id, new_custodian)
```
If an attacker compromises the server, modifies the backend script, or injects SQL, the check is nullified.

In our platform:
```solidity
// AssetNFT.sol — Enforced directly inside the Ethereum Virtual Machine:
modifier onlyActiveManager() {
    if (!hasRole(MANAGER_ROLE, msg.sender)) revert NotManager();
    if (!identityRegistry.isActive(msg.sender)) revert IdentityNotActive();
    _;
}
```
The authorization check cannot be bypassed by altering the frontend or injecting malicious API payloads. The blockchain rejects the transaction at the consensus layer.

---

### 9. Identity Revocation

The core security innovation is demonstrated through identity revocation:

1. **Engineer A** is registered and active.
2. Engineer A receives `MANAGER_ROLE`.
3. Engineer A successfully mints `BEL-TEST-1047`.
4. Administrator revokes Engineer A in `IdentityRegistry.sol`.
5. Notice: In OpenZeppelin AccessControl, Engineer A **still holds `MANAGER_ROLE`**.
6. Engineer A attempts to mint or transfer custody.
7. `AssetNFT.sol` checks `identityRegistry.isActive(msg.sender)`. It evaluates to `false`.
8. The EVM immediately **REVERTS** with `IdentityNotActive()`.

**The MVP Design Decision Regarding Stale Roles**:
In this MVP, revoking an identity does not loop through and delete roles from `AccessControl`. Instead, `isActive()` acts as a global kill-switch. This is intentional:
- Revocation is $O(1)$ constant time gas.
- If the revocation was temporary (e.g., pending internal review), the administrator can reactivate the identity without manually reconstructing all previous role assignments.

---

### 10. Audit Trail

Audit evidence is produced by EVM events:
- `IdentityRegistered(address, timestamp)`
- `IdentityRevoked(address, timestamp)`
- `IdentityReactivated(address, timestamp)`
- `RoleGranted(role, account, sender)`
- `RoleRevoked(role, account, sender)`
- `AssetMinted(tokenId, assetId, custodian, createdBy, docHash, timestamp)`
- `AssetCustodyTransferred(tokenId, from, to, transferredBy, timestamp)`

The frontend queries these event logs using standard filters (`contract.queryFilter()`) to present an immutable chronological timeline with exact block timestamps and transaction hashes.

---

### 11. Security Tests (Executed Results)

All 38 tests were executed against the Hardhat EVM (Solidity 0.8.24, Cancun target). **Zero tests were fabricated.**

| Test Category | Test Name | Expected Result | Actual Result | Status |
|---------------|-----------|-----------------|---------------|--------|
| AssetNFT | Admin has DEFAULT_ADMIN_ROLE | True | True | **PASS** |
| AssetNFT | Manager has MANAGER_ROLE | True | True | **PASS** |
| AssetNFT | User has USER_ROLE and not MANAGER_ROLE | User=True, Mgr=False | User=True, Mgr=False | **PASS** |
| AssetNFT | Active Manager can mint an asset | Emits AssetMinted | Emits AssetMinted | **PASS** |
| AssetNFT | Non-manager cannot mint an asset | Revert NotManager() | Revert NotManager() | **PASS** |
| AssetNFT | Cannot mint duplicate token IDs | Revert ERC721InvalidSender | Revert ERC721InvalidSender | **PASS** |
| AssetNFT | Cannot mint with zero address as custodian | Revert InvalidCustodian() | Revert InvalidCustodian() | **PASS** |
| AssetNFT | Active Manager can transfer custody | Emits AssetCustodyTransferred | Emits AssetCustodyTransferred | **PASS** |
| AssetNFT | Non-manager cannot transfer custody | Revert NotManager() | Revert NotManager() | **PASS** |
| AssetNFT | Cannot transfer custody to zero address | Revert InvalidCustodian() | Revert InvalidCustodian() | **PASS** |
| AssetNFT | Standard direct ERC-721 transfers are disabled | Revert DirectTransferDisabled() | Revert DirectTransferDisabled() | **PASS** |
| AssetNFT | Returns true for exact matching document hash | matches=True | matches=True | **PASS** |
| AssetNFT | Returns false for altered document hash | matches=False | matches=False | **PASS** |
| AssetNFT | Cannot remove last DEFAULT_ADMIN_ROLE holder | Revert CannotRemoveLastAdmin() | Revert CannotRemoveLastAdmin() | **PASS** |
| AssetNFT | Can revoke admin role if another admin exists | Succeeded | Succeeded | **PASS** |
| IdentityRegistry | Should set deployer as admin | admin == deployer | admin == deployer | **PASS** |
| IdentityRegistry | Starts with 0 active/revoked identities | counts == 0 | counts == 0 | **PASS** |
| IdentityRegistry | Admin can register identity | Active=True | Active=True | **PASS** |
| IdentityRegistry | Non-admin cannot register identity | Revert NotAdmin() | Revert NotAdmin() | **PASS** |
| IdentityRegistry | Cannot register zero address | Revert ZeroAddress() | Revert ZeroAddress() | **PASS** |
| IdentityRegistry | Cannot register already registered identity | Revert AlreadyRegistered() | Revert AlreadyRegistered() | **PASS** |
| IdentityRegistry | Admin can revoke identity | Active=False | Active=False | **PASS** |
| IdentityRegistry | Non-admin cannot revoke identity | Revert NotAdmin() | Revert NotAdmin() | **PASS** |
| IdentityRegistry | Cannot revoke unregistered address | Revert NotRegistered() | Revert NotRegistered() | **PASS** |
| IdentityRegistry | Cannot revoke already revoked identity | Revert AlreadyInactive() | Revert AlreadyInactive() | **PASS** |
| IdentityRegistry | Admin cannot revoke own identity (last-admin) | Revert CannotRevokeSelf() | Revert CannotRevokeSelf() | **PASS** |
| IdentityRegistry | Admin can reactivate revoked identity | Active=True | Active=True | **PASS** |
| IdentityRegistry | Non-admin cannot reactivate identity | Revert NotAdmin() | Revert NotAdmin() | **PASS** |
| IdentityRegistry | Cannot reactivate already active identity | Revert AlreadyActive() | Revert AlreadyActive() | **PASS** |
| Security Demo | Engineer B (User) tries mint -> BLOCKED | Revert NotManager() | Revert NotManager() | **PASS** |
| Security Demo | Engineer B (User) tries custodyTransfer -> BLOCKED | Revert NotManager() | Revert NotManager() | **PASS** |
| Security Demo | Revoked Engineer A tries mint -> BLOCKED | Revert IdentityNotActive() | Revert IdentityNotActive() | **PASS** |
| Security Demo | Revoked Engineer A tries custodyTransfer -> BLOCKED | Revert IdentityNotActive() | Revert IdentityNotActive() | **PASS** |
| Security Demo | Reactivating Engineer A restores privileges | Custody transferred | Custody transferred | **PASS** |
| Security Demo | Auditor cannot mint assets | Revert NotManager() | Revert NotManager() | **PASS** |
| Security Demo | Auditor cannot transfer custody | Revert NotManager() | Revert NotManager() | **PASS** |
| Security Demo | Attacker cannot grant self MANAGER_ROLE | Revert Unauthorized | Revert Unauthorized | **PASS** |
| Security Demo | Attacker cannot grant self DEFAULT_ADMIN_ROLE | Revert Unauthorized | Revert Unauthorized | **PASS** |
| Security Demo | Attacker cannot register self in IdentityRegistry | Revert NotAdmin() | Revert NotAdmin() | **PASS** |

**Summary**: 38 executed, 38 passed, 0 failed.

---

### 12. Attack Demonstrations

#### Attack 1: Unauthorized User Attempts Manager Operation
- **Attacker**: Account 2 (Engineer B)
- **Target**: Governed Asset `BEL-TEST-1047`
- **Attempted Action**: `custodyTransfer(Account 4, 1047)`
- **Security Control**: `hasRole(MANAGER_ROLE, msg.sender)`
- **Expected Result**: Smart contract reverts with `NotManager()`
- **Actual Result**: `REVERTED: NotManager()` — displayed on screen as "Caller does not have required role (MANAGER_ROLE missing)".

#### Attack 2: Revoked Manager Attempts Privileged Action
- **Attacker**: Account 1 (Engineer A)
- **Target**: Asset Creation `mintAsset(Token #2002)`
- **Attempted Action**: Privileged minting
- **Security Control**: `identityRegistry.isActive(msg.sender)`
- **Expected Result**: Smart contract reverts with `IdentityNotActive()`
- **Actual Result**: `REVERTED: IdentityNotActive()` — displayed on screen as "Active identity required — identity is revoked in IdentityRegistry.sol".

---

### 13. Privacy & Off-Chain Data Handling

Classified technical manuals, radar schematics, and confidential defense specifications are **never** placed on-chain. 

Instead, we use **Cryptographic Commitment**:
1. The operator inputs the document in the client browser.
2. The browser generates a 256-bit hash (SHA-256 / Keccak-256).
3. Only the 32-byte hash (`bytes32 documentHash`) is stored on-chain.
4. The sensitive file remains in secure off-chain storage.
5. Anyone possessing the document can run `verifyIntegrity(tokenId, currentHash)` to prove authenticity without revealing the file to the blockchain.

---

### 14. What We Built vs. Future Scope

| Built in MVP Prototype | Explicit Future Scope (Not in MVP) |
|------------------------|-----------------------------------|
| On-chain Identity Registry (wallet addresses) | Full W3C Decentralized Identifiers (DID) & VCs |
| Role-Based Access Control (4 explicit roles) | Attribute-Based Access Control (ABAC) |
| ERC-721 Governed Asset Handle | Private/Permissioned consortium network deployment |
| Smart-contract dual-check authorization | Multi-party threshold signatures (MPC / Multi-sig) |
| Disabled direct ERC-721 transfers | Decentralized file storage (IPFS / Arweave) |
| Document hash integrity verifier | Zero-Knowledge Proofs (ZKPs) for private attributes |
| Real on-chain attack demonstration suite | AI-driven anomaly detection & automated risk scoring |
| Dual MetaMask + Dev account switching | Enterprise SSO / Active Directory SCIM sync |

---

### 15. Known Limitations

We adhere to strict engineering honesty:
1. **Local Hardhat Network**: Deployed on a local EVM instance (chain ID 31337), not a live production public or permissioned consortium network.
2. **Wallet Address Identity**: Identities are represented by Ethereum wallet addresses (`address`) rather than full W3C DID documents.
3. **No Automatic Role Cleanup**: When an identity is revoked, roles in `AccessControl` remain recorded. They are neutralized by the `isActive()` check, not deleted.
4. **Single Administrator in IdentityRegistry**: The deployer is the sole administrator in `IdentityRegistry.sol`.
5. **Transitive NPM Dev Dependencies**: Development dependencies like Hardhat 2 toolchain report known non-runtime advisories during `npm audit`.

---

### 16. Why Existing Solutions Are Not Enough

| Solution Type | What it Does Well | Where it Fails for BEL Use-Case |
|---------------|-------------------|---------------------------------|
| Traditional IAM (Okta, Keycloak) | Single sign-on and directory synchronization | Centralized server; logs and permissions can be modified by DB root |
| Centralized ERP (SAP, Oracle) | Asset tracking and inventory | Authorization logic sits on app servers; lacks non-repudiable cryptographic proof |
| Public NFT Marketplaces | Digital ownership tokens | Tokens are freely transferable; anyone can sell/transfer; unsuitable for defense custody |
| Standard Multi-Sig Wallets | M-of-N signature authorization | High overhead for routine actions; lacks identity active status check |

**The Differentiator**: Our platform unifies identity, role, asset handle, contract enforcement, and evidence into one single-path evaluation.

---

### 17. Judge-Friendly Explanation

#### Explain the Project in 30 Seconds
"The Trust Continuity Platform is a governance security system designed for Bharat Electronics Limited. It connects identity, permissions, and defense asset custody directly into blockchain smart contracts. If an employee leaves or is revoked, their permissions are blocked immediately on-chain, and an audit trail is preserved that no administrator can rewrite."

#### Explain Blockchain in 20 Seconds
"A blockchain is a shared, tamper-evident digital ledger. Once an action is recorded with a digital signature, the record is linked mathematically to all previous records, making it computationally impractical for anyone to silently forge or erase past actions."

#### Explain the Innovation in 20 Seconds
"The innovation is connecting identity, role, and asset custody into one continuous smart contract rule: you cannot manage an asset with a role unless your identity is verified active on-chain at the exact moment of the transaction."

#### Why Not PostgreSQL?
"In PostgreSQL, any database administrator or root attacker can execute `UPDATE assets` or delete log tables without leaving cryptographic evidence. In our smart contract, authorization is enforced by the blockchain virtual machine, which even the platform creator cannot override."

#### Why NFT?
"We are not trading digital art. Each defense asset (like a radar module) has a unique serial number. ERC-721 gives each asset an individual on-chain identity, while our contract disables public trading so that only authorized managers can transfer custody."

#### What Happens if a Manager is Revoked?
"Their identity is flagged inactive in `IdentityRegistry.sol`. The next time they attempt any manager operation, the smart contract's `onlyActiveManager` check immediately halts execution and reverts the transaction."

#### What Happens if the Frontend is Compromised?
"Nothing dangerous. The frontend has zero authorization power. If an attacker modifies the web page to show 'ALLOWED', the actual blockchain smart contract will still check the sender's identity and reject the transaction."

#### What is Actually Decentralized?
"The authorization rules and the audit trail. They execute and reside on the blockchain ledger rather than on an internal company web server."
