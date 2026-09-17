# Operational Workflows
## Trust Continuity Platform — SIH26125 (BEL)

### Workflow 1: Employee Onboarding & Privilege Assignment
1. Administrator accesses `/identities`.
2. Admin registers new employee wallet: `registerIdentity(address)`.
3. Identity is stored as `registered = true, active = true`. Emits `IdentityRegistered`.
4. Admin assigns operational role: `grantRole(MANAGER_ROLE, address)`. Emits `RoleGranted`.

### Workflow 2: Governed Asset Minting
1. Active Manager accesses `/assets`.
2. Manager inputs asset details and optional document content.
3. Client browser computes SHA-256 hash.
4. Manager executes `mintAsset(custodian, tokenId, assetId, name, desc, hash)`.
5. Contract verifies `onlyActiveManager` -> assigns token to custodian -> stores metadata -> emits `AssetMinted`.

### Workflow 3: Controlled Custody Transfer
1. Active Manager accesses `/assets`.
2. Manager selects token ID and new custodian.
3. Manager executes `custodyTransfer(newCustodian, tokenId)`.
4. Contract verifies `onlyActiveManager` -> updates custodian -> emits `AssetCustodyTransferred`.

### Workflow 4: Security Revocation & Defense Enforcement
1. Administrator revokes departing or compromised employee: `revokeIdentity(address)`.
2. Contract sets `active = false` -> emits `IdentityRevoked`.
3. Ex-employee attempts any manager action (`mintAsset` or `custodyTransfer`).
4. Contract executes `onlyActiveManager` -> detects `isActive() == false` -> immediately **REVERTS** with `IdentityNotActive()`.
5. Audit trail records the blocked transaction attempt.
