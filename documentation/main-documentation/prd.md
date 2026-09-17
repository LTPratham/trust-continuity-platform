# Product Requirements Document (PRD)
## SIH26125 — Trust Continuity Platform
### Organization: Bharat Electronics Limited (BEL)

---

### 1. Product Vision
A blockchain-based governance, access control, and asset custody platform for defense and aerospace manufacturing, ensuring an unbroken, tamper-evident trust chain from identity verification to permanent audit proof.

---

### 2. Core Users & Personas
- **Platform Administrator**: Manages organizational identity registration, revocation, and governance roles.
- **Custody Manager (Engineer A)**: Authorized to mint governed asset records and execute custody reassignment.
- **Asset Custodian (Engineer B)**: Receives and holds custody of physical/digital assets without the ability to unilaterally transfer.
- **Independent Auditor**: Inspects the immutable on-chain event ledger for compliance and forensics.
- **Unauthorized Entity**: External or non-privileged actor whose unauthorized actions are mathematically rejected.

---

### 3. Functional Requirements
1. **Identity Registry**: Store wallet identity status (`registered`, `active`). Support `registerIdentity`, `revokeIdentity`, and `reactivateIdentity`.
2. **Role-Based Access Control**: Standardized roles `ADMIN`, `MANAGER`, `AUDITOR`, `USER`.
3. **Governed Asset NFT**: ERC-721 token handle storing `assetId`, `name`, `description`, `documentHash`, and `custodian`.
4. **Dual-Check Authorization**: Privileged actions require both `MANAGER_ROLE` and `identityRegistry.isActive() == true`.
5. **Disabled Direct Transfers**: Standard ERC-721 `transferFrom` and `approve` are disabled.
6. **Document Integrity Verification**: Support comparing off-chain document SHA-256 hash to on-chain hash.
7. **Immutable Audit Trail**: EVM events emitted for all lifecycle state transitions.

---

### 4. Non-Functional Requirements
- **Enforcement Boundary**: Blockchain EVM smart contracts (not the frontend).
- **Presentation**: Enterprise governance dashboard (Next.js + Tailwind CSS) with plain-language error translation.
- **Demo Ready**: Live demonstration executable in 2–5 minutes.
