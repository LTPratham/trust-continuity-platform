# Trust Continuity Platform — Non-Technical Judge Guide
## SIH26125 — Bharat Electronics Limited (BEL)

> **For Judges**: You do not need to be a blockchain or cryptography expert to evaluate this project. This document explains the architecture in everyday engineering language.

---

### 1. Plain-Language Technical Glossary

| Technical Term | Everyday Meaning | Why We Use It in This System |
|----------------|------------------|------------------------------|
| **Blockchain** | A shared, tamper-evident digital record book | Prevents a single database administrator from secretly altering or deleting asset records. |
| **Smart Contract** | A computer program running inside the record book that automatically enforces rules | Guarantees that rules (like "only active managers can transfer custody") cannot be bypassed by altering the website. |
| **Wallet Address** | A digital badge number representing an employee | Acts as the cryptographic identity of the employee that signs actions. |
| **NFT / ERC-721** | A unique serial number / digital control handle for an asset | Gives physical equipment (e.g., Radar Module `BEL-TEST-1047`) a unique digital record that cannot be duplicated. |
| **Role (RBAC)** | A job permission tag (Admin, Manager, User, Auditor) | Specifies what an identity is allowed to do. |
| **Event** | An indelible timestamped log entry generated when an action occurs | Creates the permanent evidence trail for auditors. |
| **Hash (SHA-256)** | A mathematical digital fingerprint of a document | Proves a technical blueprint or manual is authentic without publishing secret contents on the ledger. |
| **Revert** | The smart contract rejecting an unauthorized action and undoing state changes | Proof that the blockchain successfully stopped an unauthorized user or revoked employee. |

---

### 2. The Defense Factory Analogy

Think of a defense manufacturing plant building high-security radar modules:

1. **Security Badge (Identity)**: Every engineer has an electronic security badge. If an engineer is reassigned or suspended, security deactivates their badge.
2. **Access Clearance (Role)**: Only certified Quality Managers are allowed to authorize moving high-value components between test benches.
3. **Serial Numbered Container (Asset NFT)**: The radar module is sealed in a container with a unique serial number (`BEL-TEST-1047`).
4. **Automated Interlock Gate (Smart Contract)**: To transfer the container from Test Bench A to Test Bench B, the automated gate checks two things:
   - Does the engineer have Manager clearance?
   - Is their badge currently ACTIVE?
   - **If the badge is deactivated, the gate refuses to open — even if the badge still says 'Manager' on the plastic front.**
5. **Security Video & Log (Audit Proof)**: Every time the gate opens or refuses to open, the event is permanently written into a tamper-proof logbook.

---

### 3. Frequently Asked Questions by Judges

#### Q: "Why not just use a traditional web app with a SQL database?"
**A**: In a SQL database, the server administrator has root access. They can run a command like `UPDATE assets SET custodian = 'attacker'` or delete records from the audit table. The company would have no mathematical proof that history was altered. In our blockchain smart contract, every action requires a cryptographic signature, and historical records cannot be silently rewritten.

#### Q: "Is this cryptocurrency?"
**A**: No. There are no coins, no tokens to buy, no speculative trading, and no financial speculation. The system uses the blockchain purely as a secure distributed state machine to govern organizational equipment and records.

#### Q: "What is your main innovation?"
**A**: Most access systems check roles, but treat employee status as a separate problem. If an employee is revoked, their permissions often remain active in different tools for days. Our innovation is the **Continuous Trust Chain**: the smart contract will not execute an action unless the caller's identity is verified active on the blockchain at the exact millisecond of the transaction.

#### Q: "Can the website be hacked to allow unauthorized transfers?"
**A**: No. The website is just a viewing window. The actual authorization check happens inside the blockchain smart contract. If an attacker modifies the website code to say "ALLOW", the smart contract will still reject the transaction and revert it.

#### Q: "What about secret defense blueprints?"
**A**: Sensitive technical documents are never placed on the blockchain. The browser creates a digital fingerprint (hash) of the document. Only the fingerprint is stored on-chain. This proves whether a blueprint has been tampered with, without ever exposing the blueprint's confidential contents.
