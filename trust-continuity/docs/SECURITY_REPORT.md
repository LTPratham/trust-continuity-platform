# Trust Continuity Platform — Security Report
## SIH26125 — Bharat Electronics Limited (BEL)

---

### 1. Executive Security Summary

The Trust Continuity Platform implements smart-contract-enforced access control, identity lifecycle management, and digital asset custody. 

**Fundamental Security Principle**:
> **The smart contract, not the client application, is the sole authorization authority.**

All security constraints are enforced at the EVM bytecode level inside `IdentityRegistry.sol` and `AssetNFT.sol`. Frontend bypasses, API intercepts, or compromised browser environments cannot alter contract state without a cryptographic signature satisfying both:
1. `hasRole(REQUIRED_ROLE, msg.sender) == true`
2. `identityRegistry.isActive(msg.sender) == true`

---

### 2. Threat Model & Mitigations

| Threat | Attack Scenario | Mitigation in Trust Continuity Platform | Verification |
|--------|-----------------|-----------------------------------------|--------------|
| **T-1: Stale Role Exploitation** | Revoked employee uses previously assigned `MANAGER_ROLE` | `onlyActiveManager` verifies `isActive()` on every call | **Verified**: Attack Demo 2 reverts with `IdentityNotActive()` |
| **T-2: Horizontal Privilege Escalation** | Regular user (Engineer B) attempts custody transfer | Contract checks `hasRole(MANAGER_ROLE, msg.sender)` | **Verified**: Attack Demo 1 reverts with `NotManager()` |
| **T-3: Vertical Privilege Escalation** | Attacker grants self `ADMIN` or `MANAGER` role | OpenZeppelin `AccessControl` restricts role granting to `DEFAULT_ADMIN_ROLE` | **Verified**: Test `Attacker cannot grant themselves MANAGER_ROLE` passes |
| **T-4: Direct Asset Exfiltration** | Asset holder attempts to sell or transfer token via standard NFT call | Overridden `transferFrom()`, `approve()`, and `setApprovalForAll()` unconditionally revert | **Verified**: Test `Standard direct ERC-721 transfers are disabled` passes |
| **T-5: Admin Lockout (Accidental Denial of Service)** | Admin revokes their own identity or revokes the only admin role | `CannotRevokeSelf()` and `CannotRemoveLastAdmin()` prevent zero-admin states | **Verified**: Tests for last-admin protection pass |
| **T-6: Secret Leakage on Public Ledger** | Operator puts confidential defense specs on-chain | Platform uses SHA-256 client-side hashing; only 32-byte digest stored on-chain | **Verified**: Code review confirms zero plaintext documents stored |
| **T-7: Historical Log Tampering** | Malicious admin alters previous custody records | Custody changes emit EVM events anchored in immutable block receipts | **Verified**: EVM event logs cannot be retroactively altered without re-mining chain |

---

### 3. Automated Test Suite Results

All 38 unit and integration tests were executed against the Hardhat EVM (Cancun hardfork). **Zero tests were mocked or fabricated.**

```
  AssetNFT
    Deployment & Role Setup
      √ Admin has DEFAULT_ADMIN_ROLE
      √ Manager has MANAGER_ROLE
      √ User has USER_ROLE and not MANAGER_ROLE
    Asset Minting
      √ Active Manager can mint an asset
      √ Non-manager cannot mint an asset
      √ Cannot mint duplicate token IDs
      √ Cannot mint with zero address as custodian
    Custody Transfer (Governance Action)
      √ Active Manager can transfer custody to Engineer B
      √ Non-manager cannot transfer custody
      √ Cannot transfer custody to zero address
      √ Standard direct ERC-721 transfers are disabled
    Document Integrity Verification
      √ Returns true for exact matching document hash
      √ Returns false for altered document hash (tampering detected)
    Administrator Safety
      √ Cannot remove the last DEFAULT_ADMIN_ROLE holder
      √ Can revoke admin role if another admin exists

  IdentityRegistry
    Deployment
      √ Should set the deployer as admin
      √ Should start with 0 active and revoked identities
    Registration
      √ Admin can register identity and it becomes active
      √ Non-admin cannot register identity
      √ Cannot register the zero address
      √ Cannot register an already registered identity
    Revocation
      √ Admin can revoke identity and it becomes inactive
      √ Non-admin cannot revoke identity
      √ Cannot revoke an unregistered address
      √ Cannot revoke an already revoked identity
      √ Admin cannot revoke themselves (last-admin safety)
    Reactivation
      √ Admin can reactivate a revoked identity
      √ Non-admin cannot reactivate identity
      √ Cannot reactivate an already active identity

  Security & Attack Demonstration Suite
    Attack Scenario 1: Unauthorized User (Role Missing)
      √ Engineer B (active User) attempts to mint an asset -> BLOCKED with NotManager
      √ Engineer B (active User) attempts custodyTransfer -> BLOCKED with NotManager
    Attack Scenario 2: Revoked Manager (Identity Revoked)
      √ Revoked Engineer A retains MANAGER_ROLE in AccessControl but is BLOCKED by smart contract
      √ Reactivating Engineer A restores their ability to perform manager actions
    Attack Scenario 3: Auditor Modification Attempts
      √ Auditor cannot mint assets
      √ Auditor cannot transfer custody
    Attack Scenario 4: Privilege Escalation (Self-Promotion)
      √ Attacker cannot grant themselves MANAGER_ROLE
      √ Attacker cannot grant themselves DEFAULT_ADMIN_ROLE
      √ Attacker cannot register themselves in IdentityRegistry

  38 passing (2s)
```

---

### 4. Real Attack Demonstrations

#### Demonstration A: Unauthorized Manager Action
- **Actor**: Account 2 (`0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` - Engineer B)
- **Status**: Registered & Active, `USER_ROLE`
- **Attempt**: `custodyTransfer(Account 4, 1047)`
- **Enforcement**:
  ```solidity
  if (!hasRole(MANAGER_ROLE, msg.sender)) revert NotManager();
  ```
- **Outcome**: EVM execution halted, transaction reverted with custom error `NotManager()`.
- **UI Translation**: "Caller does not have required role (MANAGER_ROLE missing)".

#### Demonstration B: Revoked Identity Action
- **Actor**: Account 1 (`0x70997970C51812dc3A010C7d01b50e0d17dc79C8` - Engineer A)
- **Status**: Identity Revoked by Admin, but still holds `MANAGER_ROLE` in AccessControl
- **Attempt**: `mintAsset(...)`
- **Enforcement**:
  ```solidity
  if (!identityRegistry.isActive(msg.sender)) revert IdentityNotActive();
  ```
- **Outcome**: EVM execution halted, transaction reverted with custom error `IdentityNotActive()`.
- **UI Translation**: "Active identity required — identity is revoked in IdentityRegistry.sol".

---

### 5. Dependency Audit Analysis (`npm audit`)

Running `npm audit` on development dependencies reported 46 advisories across build tooling (`undici`, `tmp`, `lodash`, `ws` in Hardhat 2 toolchain).
- **Assessment**: These advisories affect local Node.js development server tooling, not deployed EVM smart contracts.
- **Smart Contract Dependencies**: The contracts exclusively import audited OpenZeppelin Contracts v5 (`@openzeppelin/contracts/token/ERC721/ERC721.sol`, `@openzeppelin/contracts/access/AccessControl.sol`), with zero external library vulnerabilities.

---

### 6. Security Checklist & Disclaimers

- [x] Non-manager cannot mint
- [x] Non-manager cannot transfer custody
- [x] Revoked manager cannot perform manager actions
- [x] Inactive identity retains zero operational privileges
- [x] Unauthorized users cannot grant themselves roles
- [x] Duplicate token IDs cannot be minted
- [x] Invalid recipient addresses (address(0)) are rejected
- [x] Direct ERC-721 transfers are disabled
- [x] Last-admin protection prevents lockout
- [x] No plaintext sensitive documents are stored on-chain
- [x] Frontend cannot bypass smart contract authorization
- [x] All test results reflect actual execution

**Disclaimer**:
No computing system is "100% secure" or "unhackable." The security guarantees of this platform depend on the integrity of the underlying private keys (MetaMask / hardware wallet) and the consensus integrity of the host blockchain network.
