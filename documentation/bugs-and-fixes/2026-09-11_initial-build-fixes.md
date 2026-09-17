# Bug & Fix Log: 2026-09-11 Initial Build & Toolchain Fixes
## SIH26125 — Trust Continuity Platform

### Bug 1: Hardhat Toolchain & TypeScript Compatibility
- **Description**: `npx hardhat compile` failed with `TypeError: Cannot read properties of undefined (reading 'fileExists')`.
- **Root Cause**: `npm install typescript` pulled pre-release TypeScript 7.0 which broke `ts-node` 10.9.2 due to internal API refactors in compiler configuration loading.
- **Fix Applied**: Pinned `typescript: "5.4.5"`, configured Hardhat 2 with `@nomicfoundation/hardhat-toolbox@^5.0.0`, and standardized `tsconfig.json` to CommonJS with `moduleResolution: "node"`.
- **Files Modified**: `trust-continuity/package.json`, `trust-continuity/tsconfig.json`.
- **Verification**: `npx hardhat compile` compiled cleanly.

### Bug 2: OpenZeppelin 5.x Cancun EVM Instruction (`mcopy`)
- **Description**: Compilation error in OpenZeppelin `Bytes.sol`: `DeclarationError: Function "mcopy" not found`.
- **Root Cause**: OpenZeppelin 5.2 uses the `mcopy` EVM instruction introduced in the Ethereum Cancun hardfork. The default Solidity compiler EVM target was pre-Cancun.
- **Fix Applied**: Configured `evmVersion: "cancun"` in `hardhat.config.ts`.
- **Files Modified**: `trust-continuity/hardhat.config.ts`.
- **Verification**: All 19 Solidity contracts compiled successfully with 0 errors.
