# Trust Continuity Platform — Implementation Plan

## SIH26125 — Blockchain-Based Secure Platform for Identity, Access Control, and Digital Asset Management

> [!IMPORTANT]
> This plan builds a **small, working, judge-ready MVP** — not a production system.
> Architecture: **Next.js → MetaMask → Solidity Contracts → Local Hardhat Blockchain**
> No backend server. The blockchain is the sole authorization authority.

---

## System Architecture

```
┌──────────────────────────────────────────────────┐
│                    USER (Browser)                 │
│                                                   │
│   Next.js Dashboard (TypeScript + Tailwind CSS)   │
│   ├── Dashboard         — status overview         │
│   ├── Identities        — register/revoke/roles   │
│   ├── Assets            — mint/transfer/verify    │
│   ├── Audit History     — blockchain event log     │
│   └── Security Demo     — attack scenarios         │
└─────────────────────┬────────────────────────────┘
                      │ ethers.js v6
                      ▼
┌──────────────────────────────────────────────────┐
│               MetaMask Wallet                     │
│   Signs every transaction — user proves identity  │
└─────────────────────┬────────────────────────────┘
                      │ JSON-RPC
                      ▼
┌──────────────────────────────────────────────────┐
│          Hardhat Local Blockchain                 │
│                                                   │
│   ┌─────────────────────────────────────────┐    │
│   │       IdentityRegistry.sol              │    │
│   │   • registerIdentity(address)           │    │
│   │   • revokeIdentity(address)             │    │
│   │   • reactivateIdentity(address)         │    │
│   │   • isActive(address) → bool            │    │
│   │   • Events: Registered/Revoked/Reactivated│  │
│   └─────────────────────────────────────────┘    │
│                                                   │
│   ┌─────────────────────────────────────────┐    │
│   │           AssetNFT.sol                  │    │
│   │   extends ERC721 + AccessControl        │    │
│   │   • Roles: ADMIN, MANAGER, AUDITOR, USER│    │
│   │   • mintAsset(custodian, tokenId, ...)  │    │
│   │   • custodyTransfer(to, tokenId)        │    │
│   │   • Checks: role + active identity      │    │
│   │   • Events: Minted/CustodyTransferred   │    │
│   │   • Links to IdentityRegistry           │    │
│   └─────────────────────────────────────────┘    │
│                                                   │
│   Events emitted → queryable as audit trail       │
└──────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| Blockchain | Hardhat | ^2.22.x | Local dev chain, built-in testing |
| Smart Contracts | Solidity | 0.8.24 | Stable, well-supported |
| Standard Library | OpenZeppelin Contracts | ^5.1.x | Battle-tested ERC721 + AccessControl |
| Frontend | Next.js | 14.x (App Router) | SSR-capable React framework |
| Styling | Tailwind CSS | 3.x | Utility-first, fast styling |
| Blockchain Client | ethers.js | 6.x | Contract interaction from browser |
| Wallet | MetaMask | Browser extension | Signs transactions |
| Language | TypeScript | 5.x | Type safety everywhere |
| Testing | Hardhat + Chai | Built-in | Contract test suite |

---

## Demo Accounts (Hardhat Default)

| Account # | Role | Label | Hardhat Address |
|-----------|------|-------|-----------------|
| 0 | ADMIN | Platform Admin | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| 1 | MANAGER | Engineer A | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| 2 | USER | Engineer B | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` |
| 3 | AUDITOR | Auditor | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` |
| 4 | NONE | Unauthorized User | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` |

---

## Open Questions

> [!IMPORTANT]
> **Q1: MetaMask vs. development account switcher?**
> MetaMask requires manual account importing for each Hardhat private key. For a live demo, this is slow. Two options:
> - **Option A**: Use MetaMask with pre-imported accounts (setup once before demo)
> - **Option B**: Add a dev-only account switcher dropdown in the UI that uses `ethers.Wallet` directly (faster demo, clearly labeled "DEVELOPMENT ONLY")
>
> I recommend **Option B** for demo speed, with a prominent "DEV MODE" banner. MetaMask can still be used if preferred.

> [!NOTE]
> **Q2: Document hash integrity feature**
> The spec marks this as secondary. I'll implement it as a simple text input → SHA-256 → store hash on-chain during asset minting, with a "Verify Integrity" button. If this adds too much time, it can be cut.

---

## Proposed Changes — Phase by Phase

---

### Phase 2: Project Structure

#### [NEW] Project scaffolding

```
trust-continuity/
├── contracts/
│   ├── IdentityRegistry.sol
│   └── AssetNFT.sol
├── test/
│   ├── IdentityRegistry.test.ts
│   ├── AssetNFT.test.ts
│   └── Security.test.ts
├── scripts/
│   └── deploy.ts
├── frontend/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Dashboard
│   │   ├── identities/page.tsx
│   │   ├── assets/page.tsx
│   │   ├── audit/page.tsx
│   │   └── security/page.tsx
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── StatusCard.tsx
│   │   ├── IdentityTable.tsx
│   │   ├── AssetTable.tsx
│   │   ├── AuditLog.tsx
│   │   ├── AttackCard.tsx
│   │   ├── AccountSwitcher.tsx
│   │   └── TransactionResult.tsx
│   ├── lib/
│   │   ├── contracts.ts        # ABI + addresses + ethers setup
│   │   ├── blockchain.ts       # Read helpers (events, state)
│   │   └── constants.ts        # Account labels, role names
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BUILD_REPORT.md
│   ├── SECURITY_REPORT.md
│   ├── DEMO_GUIDE.md
│   └── JUDGE_EXPLANATION.md
├── documentation/              # Project brain (per global rule)
│   ├── implementation-plans/
│   ├── main-documentation/
│   ├── progress-tracking/
│   ├── bugs-and-fixes/
│   └── licensing/
├── hardhat.config.ts
├── package.json
└── README.md
```

---

### Phase 3: IdentityRegistry.sol

#### [NEW] [IdentityRegistry.sol](file:///d:/projects/sih_pROTOTYPE/trust-continuity/contracts/IdentityRegistry.sol)

**Purpose**: Blockchain-anchored identity status registry. Each wallet address can be registered, revoked, or reactivated.

**Design**:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract IdentityRegistry {
    struct Identity {
        bool registered;
        bool active;
    }

    mapping(address => Identity) private identities;
    address public admin;

    // Custom errors
    error NotAdmin();
    error AlreadyRegistered();
    error NotRegistered();
    error AlreadyActive();
    error AlreadyInactive();
    error ZeroAddress();

    // Events
    event IdentityRegistered(address indexed identity, uint256 timestamp);
    event IdentityRevoked(address indexed identity, uint256 timestamp);
    event IdentityReactivated(address indexed identity, uint256 timestamp);

    modifier onlyAdmin() { if (msg.sender != admin) revert NotAdmin(); _; }

    constructor() { admin = msg.sender; }

    function registerIdentity(address _identity) external onlyAdmin { ... }
    function revokeIdentity(address _identity) external onlyAdmin { ... }
    function reactivateIdentity(address _identity) external onlyAdmin { ... }
    function isRegistered(address _identity) external view returns (bool) { ... }
    function isActive(address _identity) external view returns (bool) { ... }
}
```

**Key decisions**:
- Single admin model (deployer) — simple for MVP, prevents dangerous states
- Custom errors instead of require strings — gas-efficient, clear
- Timestamps in events for audit trail
- No self-revocation protection needed (admin can revoke anyone including themselves — this is a known limitation documented honestly)

---

### Phase 4: AssetNFT.sol + AccessControl

#### [NEW] [AssetNFT.sol](file:///d:/projects/sih_pROTOTYPE/trust-continuity/contracts/AssetNFT.sol)

**Purpose**: ERC-721 token representing governed asset records. Integrates OpenZeppelin AccessControl for role management. Links to IdentityRegistry for active-identity checks.

**Design**:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AssetNFT is ERC721, AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant USER_ROLE = keccak256("USER_ROLE");

    IIdentityRegistry public identityRegistry;

    struct AssetData {
        string assetId;       // e.g., "BEL-TEST-1047"
        string name;
        string description;
        bytes32 documentHash; // SHA-256 hash of associated document
        address custodian;
        address createdBy;
        uint256 createdAt;
    }

    mapping(uint256 => AssetData) public assets;
    uint256 public totalAssets;

    // Custom errors
    error IdentityNotActive();
    error NotManager();
    error AssetDoesNotExist();
    error InvalidCustodian();

    // Events
    event AssetMinted(uint256 indexed tokenId, string assetId, address custodian, address createdBy, uint256 timestamp);
    event AssetCustodyTransferred(uint256 indexed tokenId, address indexed from, address indexed to, address transferredBy, uint256 timestamp);

    modifier onlyActiveManager() {
        if (!hasRole(MANAGER_ROLE, msg.sender)) revert NotManager();
        if (!identityRegistry.isActive(msg.sender)) revert IdentityNotActive();
        _;
    }

    constructor(address _identityRegistry) ERC721("Trust Continuity Asset", "TCA") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    function mintAsset(
        address custodian,
        uint256 tokenId,
        string memory assetId,
        string memory name,
        string memory description,
        bytes32 documentHash
    ) external onlyActiveManager { ... }

    function custodyTransfer(
        address newCustodian,
        uint256 tokenId
    ) external onlyActiveManager { ... }

    // Override supportsInterface for ERC721 + AccessControl
    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl) returns (bool) { ... }
}
```

**Critical authorization logic**:
```
mintAsset / custodyTransfer
    → onlyActiveManager modifier
        → Step 1: hasRole(MANAGER_ROLE, msg.sender)?  → if NO → revert NotManager
        → Step 2: identityRegistry.isActive(msg.sender)? → if NO → revert IdentityNotActive
        → Step 3: proceed with operation
```

**Key decisions**:
- `custodyTransfer` is a **governance action** — only a manager can transfer, NOT the current holder
- Document hash is `bytes32` (SHA-256) — stored on-chain, document stays off-chain
- `totalAssets` counter for dashboard stats
- ERC-721 `_mint` goes to custodian address, but `ownerOf` reflects custody rather than "ownership" in the crypto sense

---

### Phase 5: Solidity Tests

#### [NEW] [IdentityRegistry.test.ts](file:///d:/projects/sih_pROTOTYPE/trust-continuity/test/IdentityRegistry.test.ts)

Tests:
1. Admin can register identity
2. Non-admin cannot register identity
3. Registered identity is active
4. Admin can revoke identity
5. Revoked identity is inactive
6. Admin can reactivate identity
7. Reactivated identity is active again
8. Cannot register already-registered identity
9. Cannot revoke unregistered identity
10. Zero address rejected

#### [NEW] [AssetNFT.test.ts](file:///d:/projects/sih_pROTOTYPE/trust-continuity/test/AssetNFT.test.ts)

Tests:
1. Manager can mint asset
2. Non-manager cannot mint asset
3. Manager can transfer custody
4. Non-manager cannot transfer custody
5. Duplicate token ID rejected
6. Invalid (zero address) custodian rejected
7. Custodian is updated correctly after transfer

#### [NEW] [Security.test.ts](file:///d:/projects/sih_pROTOTYPE/trust-continuity/test/Security.test.ts)

Tests:
1. **Revoked manager cannot mint** — THE critical test
2. **Revoked manager cannot transfer custody**
3. Auditor cannot mint
4. Auditor cannot transfer custody
5. User cannot mint
6. User cannot transfer custody
7. Unauthorized user cannot grant themselves roles
8. Revoked manager regains access after reactivation + re-granting role

---

### Phase 6: Local Deployment

#### [NEW] [deploy.ts](file:///d:/projects/sih_pROTOTYPE/trust-continuity/scripts/deploy.ts)

Deployment script that:
1. Deploys `IdentityRegistry` from Account 0 (Admin)
2. Deploys `AssetNFT` with IdentityRegistry address
3. Registers Accounts 1–4 as identities
4. Grants MANAGER_ROLE to Account 1 (Engineer A)
5. Grants USER_ROLE to Account 2 (Engineer B)
6. Grants AUDITOR_ROLE to Account 3 (Auditor)
7. Mints a demo asset `BEL-TEST-1047` via Account 1
8. Saves deployed addresses + ABIs to `frontend/lib/deployments.json`
9. Prints clear summary of setup

---

### Phase 7–10: Frontend

#### Frontend Pages

| Page | Purpose | Key Components |
|------|---------|----------------|
| **Dashboard** (`/`) | Overview cards + lifecycle diagram | StatusCard ×5, ASCII lifecycle |
| **Identities** (`/identities`) | Register/revoke/reactivate + role management | IdentityTable, action buttons |
| **Assets** (`/assets`) | Mint/transfer/verify integrity | AssetTable, mint form, transfer form |
| **Audit** (`/audit`) | Blockchain event log | AuditLog table with filters |
| **Security** (`/security`) | Attack demonstration cards | AttackCard ×2 with live execution |

#### Key Frontend Components

| Component | Purpose |
|-----------|---------|
| `Header` | Nav bar + current account display + account switcher |
| `AccountSwitcher` | Dev-only dropdown to switch between demo accounts |
| `StatusCard` | Dashboard stat card (count + label) |
| `TransactionResult` | Shows success/failure with human-readable messages |
| `AttackCard` | Executes attack scenario, shows BLOCKED result |

#### Human-Readable Error Mapping

| Solidity Error | UI Message |
|---------------|------------|
| `NotManager()` | "Manager permission required" |
| `IdentityNotActive()` | "Active identity required — identity is revoked or not registered" |
| `NotAdmin()` | "Administrator permission required" |
| `AlreadyRegistered()` | "This identity is already registered" |
| `InvalidCustodian()` | "Invalid recipient address" |

#### Account Switcher (Dev Mode)

For the demo, a dropdown labeled **"DEMO ACCOUNTS — DEVELOPMENT ONLY"** that connects using Hardhat's pre-funded private keys via `ethers.Wallet`. This avoids MetaMask account-switching delays during the live demo.

MetaMask remains supported as an alternative.

---

### Phase 11–12: Testing & Security Review

**Automated**:
- Run full Hardhat test suite (`npx hardhat test`)
- Check for Solidity compiler warnings
- `npm audit` for dependency vulnerabilities

**Manual Security Checks**:
- [ ] Non-manager cannot mint
- [ ] Non-manager cannot transfer
- [ ] Revoked manager blocked
- [ ] Auditor cannot modify state
- [ ] Unauthorized cannot self-grant roles
- [ ] Duplicate token IDs rejected
- [ ] Zero-address rejected
- [ ] Frontend cannot bypass contract authorization
- [ ] No sensitive data stored on-chain

---

### Phase 13: Documentation

#### [NEW] docs/BUILD_REPORT.md
Full 17-section report as specified in requirements §19

#### [NEW] docs/SECURITY_REPORT.md
Test results, attack demonstrations, security review findings

#### [NEW] docs/DEMO_GUIDE.md
3-minute timed presentation script

#### [NEW] docs/JUDGE_EXPLANATION.md
Simple-language glossary + FAQ for non-technical judges

#### [NEW] docs/ARCHITECTURE.md
System architecture with diagrams

#### [NEW] README.md
Complete setup, installation, and run instructions

---

## Verification Plan

### Automated Tests
```bash
cd trust-continuity
npx hardhat test
```
Expected: 15+ tests covering identity, assets, and security scenarios.

### Manual Verification
1. Start Hardhat node: `npx hardhat node`
2. Deploy contracts: `npx hardhat run scripts/deploy.ts --network localhost`
3. Start frontend: `cd frontend && npm run dev`
4. Walk through the 13-step demo scenario:
   - Register → Assign role → Mint asset → Transfer custody → Revoke → Attack blocked → Audit visible
5. Verify both attack scenarios produce real contract reverts (not frontend fakes)

---

## What We Are Deliberately NOT Building

| Excluded Feature | Why |
|-----------------|-----|
| Backend API server | Blockchain is the authority; no backend needed for MVP |
| Database (Supabase/Postgres) | Events on-chain serve as the data layer |
| AI/ML | Not relevant to core identity + authorization demo |
| W3C DID/VC | Future extension; MVP uses wallet addresses |
| Zero-knowledge proofs | Unnecessary complexity for MVP |
| IPFS | No large file storage needed |
| Multi-chain | Single local chain sufficient |
| MFA/biometrics | Future extension |
| Complex token economics | We are NOT building cryptocurrency |
| Kubernetes/microservices | Local dev stack only |

---

## Estimated Deliverable Count

| Category | Count |
|----------|-------|
| Smart contracts | 2 |
| Test files | 3 |
| Frontend pages | 5 |
| Frontend components | ~10 |
| Documentation files | 6 |
| Scripts | 1 deploy script |
| Config files | ~5 (hardhat, next, tailwind, tsconfig, package.json) |

Total: ~30-35 files — small, focused, explainable.
