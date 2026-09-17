# System Architecture
## Trust Continuity Platform — SIH26125 (BEL)

### Architectural Layers

```
Layer 1: User / Signer Layer (MetaMask / Local Signer)
              ↓
Layer 2: Enterprise Web Application (Next.js 14, React 18, Tailwind CSS)
              ↓
Layer 3: Smart Contract Enforcement (Solidity 0.8.24 on Hardhat EVM - Cancun)
         • IdentityRegistry.sol
         • AssetNFT.sol (ERC-721 + OpenZeppelin AccessControl)
              ↓
Layer 4: Immutable Ledger & Event Receipts (EVM Block Logs)
```

### Authorization Rules
$$\text{Privileged Action Allowed} \iff \text{Caller has Role} \land \text{Caller Identity is Active}$$

If an identity is revoked, the operation reverts with `IdentityNotActive()` even if the role is present in storage.
