# Trust Continuity Platform — SIH26125

**Blockchain-Based Secure Platform for Identity, Access Control, and Digital Asset Management**

**Organization:** Bharat Electronics Limited (BEL)  
**Theme:** Blockchain & Cybersecurity  
**Problem Statement:** SIH26125

---

## Problem Statement

BEL manages a large portfolio of sensitive defense hardware assets across organizational units. Key challenges:

- Establishing cryptographically verifiable organizational identity for personnel who govern these assets
- Enforcing role-based access control that cannot be overridden by any single actor
- Maintaining a tamper-evident audit trail of custody changes and lifecycle events
- Creating a structured, multi-step transfer workflow that prevents unauthorized or premature custody changes
- Providing a deterministic policy engine to evaluate whether an operation should be permitted before it is submitted to the chain

---

## SIH26125 Alignment

| Requirement | Implementation |
|---|---|
| Blockchain-based identity | `IdentityRegistry.sol` — on-chain wallet identity registry with credential hash binding |
| Access control | OpenZeppelin AccessControl — MANAGER, AUDITOR, USER, ADMIN roles enforced in Solidity |
| Digital asset management | `AssetNFT.sol` — ERC-721 tokens representing governed asset records with restricted custody transfer |
| Audit trail | Immutable on-chain events for every identity, role, asset, attestation, and transfer event |
| Trust Continuity | Identity + Role + Asset State evaluated deterministically before each operation |

---

## Trust Continuity Architecture

The platform's innovation beyond a basic RBAC/NFT system is the **Trust Continuity layer**: a deterministic policy engine that evaluates a full authorization chain before any critical operation.

```
Request Action
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ TRUST CONTINUITY CHECK CHAIN                        │
│                                                     │
│ 1. IDENTITY REGISTERED? ─── No ──→ DENY             │
│ 2. IDENTITY ACTIVE?     ─── No ──→ DENY             │
│ 3. ROLE VALID?          ─── No ──→ DENY             │
│ 4. PERMISSION GRANTED?  ─── No ──→ DENY             │
│ 5. ASSET EXISTS?        ─── No ──→ DENY             │
│ 6. ASSET STATE ALLOWED? ─── No ──→ DENY             │
│ 7. AUTHORIZATION VALID? ─── No ──→ DENY             │
│                              Yes ──→ ALLOW           │
└─────────────────────────────────────────────────────┘
     │
     ▼
Smart Contract Execution (or Rejection)
```

**Key design principle:** Role assignment alone is insufficient. A manager whose identity is revoked retains their role record (as audit evidence) but is blocked at the `isActive()` check in every contract operation.

---

## Smart Contracts

### `IdentityRegistry.sol`
- Blockchain-backed Organizational Identity Registry
- Stores: address → `{registered, active, credentialHash, registeredAt, label}`
- `credentialHash` = hash of off-chain credential reference — sensitive data never on-chain
- Admin-only: `registerIdentity`, `revokeIdentity`, `reactivateIdentity`, `updateCredential`
- Last-admin protection: admin cannot revoke their own identity

### `AssetNFT.sol`
- ERC-721 + OpenZeppelin AccessControl
- Asset lifecycle states: `REGISTERED → ALLOCATED → IN_CUSTODY → UNDER_INSPECTION → TRANSFER_PENDING → TRANSFERRED / SUSPENDED / REVOKED`
- Every custody transfer requires MANAGER_ROLE + active identity (`onlyActiveManager` modifier)
- Standard ERC-721 `transferFrom`, `approve`, `setApprovalForAll` — permanently disabled
- Physical-digital binding: `physicalIdentifierHash`, `assetStateHash`, `metadataHash` stored per asset
- `trustedTransfer()` — callable only by the authorized `TransferLifecycle` contract

### `AssetAttestation.sol`
- Immutable physical-digital binding attestation registry
- Append-only per-token history: `Attestation{physicalIdentifierHash, assetStateHash, attestedBy, timestamp, valid}`
- `VERIFIER_ROLE` required to submit
- Admin can invalidate erroneous records (the record is preserved; only the `valid` flag changes)
- `getLatestValidAttestation(tokenId)` and `hasValidAttestation()` for downstream validation

### `TransferLifecycle.sol`
- 6-step governed transfer state machine
- States: `TRANSFER_REQUESTED → ORIGIN_VERIFIED → ASSET_STATE_VERIFIED → DESTINATION_AUTHORIZED → DESTINATION_ACCEPTED → TRANSFER_CONFIRMED` (or `TRANSFER_REJECTED`)
- Trust Continuity checks at both `requestTransfer` and `confirmTransfer`
- Every state transition emits a blockchain event for audit

---

## Frontend Modules

| Route | Purpose |
|---|---|
| `/` | Platform landing page |
| `/dashboard` | Operational console with chain statistics |
| `/identities` | Identity registry management (register, revoke, reactivate) |
| `/assets` | Asset registry with state display, mint, integrity verification |
| `/trust-engine` | **Trust Continuity Engine** — interactive ALLOW/DENY check visualization |
| `/attestation` | Physical-digital binding submission and history |
| `/transfer` | Governed transfer lifecycle pipeline |
| `/rbac` | RBAC Permission Matrix — all roles and permissions across all contracts |
| `/audit` | Unified on-chain event audit timeline |
| `/security` | Attack scenario demonstrations |

---

## Threat Scenarios

The platform reduces risk in these authorization failure scenarios:

| Scenario | Without Platform | With Platform |
|---|---|---|
| Unregistered user attempts asset operation | Depends on application-layer checks | Smart contract rejects — `NotRegistered` |
| Active user lacks required role | Depends on RBAC implementation | Smart contract rejects — `NotManager` |
| Revoked manager attempts operation | Role may still grant access | Smart contract rejects — `IdentityNotActive` |
| Self-promotion (role escalation) | Possible if admin key compromised | Admin key required; all grants on-chain |
| Unauthorized custody transfer | Possible with direct ERC-721 transfer | `DirectTransferDisabled` — use only `custodyTransfer()` |
| Transfer without lifecycle validation | Immediate custody change possible | Lifecycle enforces 6-step validation |
| Asset suspended during transfer | Operation may proceed | `AssetSuspendedOrRevoked` blocks all operations |

---

## Test Coverage

86 tests across 5 suites — all passing.

| Suite | Tests | What it covers |
|---|---|---|
| `IdentityRegistry.test.ts` | 16 | Registration, revocation, reactivation, credential update, last-admin safety |
| `AssetNFT.test.ts` | 26 | Minting, state management, attestation, custody transfer, integrity, admin safety |
| `Security.test.ts` | 11 | 5 attack scenarios: unauthorized user, revoked manager, auditor escalation, privilege escalation, suspended asset |
| `AssetAttestation.test.ts` | 18 | Submission, invalid hash rejection, multi-attestation, invalidation, latest valid lookup |
| `TransferLifecycle.test.ts` | 15 | Full 6-step happy path, 7 DENY scenarios, rejection, re-validation at confirm, trustedTransfer protection |

Run: `npx hardhat test`

---

## Architecture Limitations (Prototype Scope)

1. **No hardware oracle.** `physicalIdentifierHash` records a hash of a submitted identifier — independent physical verification of that identifier is required off-chain. The blockchain records the binding, not the authenticity of the physical object itself.

2. **Private keys in demo scripts.** The deployed demo accounts use hardhat default keys. Production deployment would use HSM-backed keys and MetaMask.

3. **IdentityRegistry is centralized.** A single admin manages all identities. A production system would use multi-sig or a DAO governance contract.

4. **No IPFS / off-chain storage.** Document hashes are stored on-chain; the documents themselves must be stored separately.

5. **No formal W3C DID implementation.** The `credentialHash` field provides a DID-compatible binding point for future expansion.

---

## Local Development

```bash
# Terminal 1 — Start blockchain node
cd trust-continuity
npx hardhat node

# Terminal 2 — Deploy all 4 contracts
npx hardhat run scripts/deploy.ts --network localhost

# Run test suite
npx hardhat test

# Terminal 3 — Start frontend
cd frontend
npm run dev
```

Open `http://localhost:3000`. Use the dev account switcher in the header to switch between roles.

---

## Contributors

- Prathamesh Sawarkar ([@LTPratham](https://github.com/LTPratham))
- Sarthak Dhatrak ([@SarthakDhatrak](https://github.com/SarthakDhatrak))
- Sunil Yadav ([@SUNNYYDV1507](https://github.com/SUNNYYDV1507))
- Shubham ([@shub203](https://github.com/shub203))
- Kirat ([@kirat2005](https://github.com/kirat2005))
- Manjeet ([@mmrehu](https://github.com/mmrehu))
