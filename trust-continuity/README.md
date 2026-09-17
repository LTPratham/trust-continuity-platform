# Trust Continuity Platform

[![Smart India Hackathon 2026](https://img.shields.io/badge/SIH-2026-blue.svg)](https://sih.gov.in/)
[![Problem Statement](https://img.shields.io/badge/Problem%20Statement-SIH26125-orange.svg)](https://sih.gov.in/)
[![Partner](https://img.shields.io/badge/Defense%20Partner-Bharat%20Electronics%20Limited%20(BEL)-emerald.svg)](https://bel-india.in/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24%20(Cancun)-363636.svg)](https://soliditylang.org/)
[![Tests](https://img.shields.io/badge/Tests-38%20Passed%20%2F%200%20Failed-success.svg)](./trust-continuity/test)

> **Blockchain-Based Secure Platform for Identity, Access Control, and Digital Asset Management**  
> Developed for **Bharat Electronics Limited (BEL)** under Smart India Hackathon 2026.

---

## 👥 Project Team & Contributors

* **Prathamesh Sawarkar** ([@LTPratham](https://github.com/LTPratham)) — Lead Full-Stack Architect & Smart Contracts
* **Sunny Yadav** ([@SUNNYYDV1507](https://github.com/SUNNYYDV1507)) — Core Contributor & Security QA
* **Sarthak Dhatrak** ([@SarthakDhatrak](https://github.com/SarthakDhatrak)) — Core Contributor & Defense Workflows

---

## 🎯 1. Problem Statement & Defense Context

In high-security defense electronics manufacturing at **Bharat Electronics Limited (BEL)**, high-value components (e.g. tactical radar modules, avionics mission computers, cryptographic communication units) move between cleanrooms, vibration test labs, and deployment depots.

Traditional enterprise IT faces three fatal vulnerabilities:
1. **The Stale Role Retention Threat:** When an engineer leaves or is reassigned, credentials and access tokens linger across workstations for hours or days.
2. **The Rogue Database Administrator (DBA) Threat:** In standard SQL systems (PostgreSQL/Oracle), anyone with root database credentials can run `UPDATE assets` or truncate audit logs without leaving mathematical proof.
3. **Broken Hardware Custody:** Physical equipment handoffs lack cryptographic non-repudiation.

---

## 🛡️ 2. The Solution: Three Core Innovations

1. **On-Chain Identity Registry (`IdentityRegistry.sol`):**  
   Personnel identity status is maintained directly on Ethereum EVM bytecode. Revocation acts as an instant $O(1)$ kill-switch with last-admin self-revocation protection.
2. **Dual-Condition Smart Contract Enforcement (`AssetNFT.sol`):**  
   Every privileged action requires `onlyActiveManager`:
   $$\text{Action Permitted} \iff \text{Caller has MANAGER\_ROLE} \land \text{Identity is ACTIVE in Registry}$$
   If an employee is revoked, the Solidity contract halts and reverts immediately, neutralizing authority even if the role was not stripped.
3. **Governed ERC-721 Hardware Tokens:**  
   Standard `transferFrom`, `approve`, and `setApprovalForAll` are permanently disabled. Hardware custody can only be reassigned through `custodyTransfer()`, emitting immutable audit logs with SHA-256 document fingerprints.

---

## 📐 3. System Architecture

```
User (Browser / Evaluator)
      ↓
MetaMask / Signer (Hardware Token or Test Accounts)
      ↓
Next.js 14 Enterprise Dashboard (Light Theme, AppTour, Ethers.js v6)
      ↓
Solidity Smart Contracts (Hardhat Cancun EVM)
   ├── IdentityRegistry.sol  (Identity Status, Instant Kill-Switch)
   └── AssetNFT.sol          (Restricted ERC-721 Custody & RBAC)
      ↓
Immutable Blockchain Event Logs (Cryptographic Evidence Trail)
```

---

## 🚀 4. Quick Start Guide

### Prerequisites
* Node.js v18.x or v20.x+
* npm v9.x+

### Step 1: Clone the Repository
```bash
git clone https://github.com/LTPratham/trust-continuity-platform.git
cd trust-continuity-platform/trust-continuity
```

### Step 2: Install Dependencies
```bash
npm install
cd frontend && npm install && cd ..
```

### Step 3: Start Local Blockchain Node
```bash
npx hardhat node
```

### Step 4: Deploy Smart Contracts (in a second terminal)
```bash
npx hardhat run scripts/deploy.ts --network localhost
```

### Step 5: Start the Web Dashboard (in a third terminal)
```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 5. Testing & Verification

Run the comprehensive 38-test security and functional test suite:
```bash
cd trust-continuity
npx hardhat test
```

Result:
```
  AssetNFT Contract
    ✔ 22 tests passing
  IdentityRegistry Contract
    ✔ 10 tests passing
  Security & Attack Bypass Tests
    ✔ 6 tests passing

  38 passing (1.8s)
```

---

## 📄 6. Licensing & Compliance

This prototype is submitted for **Smart India Hackathon 2026** under problem statement **SIH26125** in collaboration with **Bharat Electronics Limited (BEL)**.
