# Trust Continuity Platform — Live Demonstration Guide
## SIH26125 — Bharat Electronics Limited (BEL)

---

### 1. Presentation Overview

- **Target Duration**: 3 minutes (up to 5 minutes with Q&A)
- **Primary Message**: 
  *"The smart contract is the security boundary. Revoking an identity immediately neutralizes all authority on-chain, and every action leaves permanent evidence."*
- **Key Visual Artifacts**:
  - Continuous Trust Chain on Dashboard
  - Identities Table with Live Active/Revoked Badges
  - Governed Assets Table with Document Hashes
  - Live Attack Demonstrations with Smart Contract Reverts
  - Immutable Event Audit Trail

---

### 2. Timed 3-Minute Presentation Script

```
┌─────────────┬───────────────────────────────────────────┬──────────────────────────────────────────┐
│ Time        │ What You Say                              │ What You Do on Screen                    │
├─────────────┼───────────────────────────────────────────┼──────────────────────────────────────────┤
│ 0:00 – 0:20 │ "Good morning judges. For Bharat          │ Show Dashboard. Point to the             │
│             │ Electronics Limited, managing defense     │ Continuous Trust Chain diagram           │
│             │ assets requires absolute certainty:       │ (WHO -> WHAT -> WHICH ASSET ->           │
│             │ who is acting, what are they allowed to   │ ENFORCEMENT -> EVIDENCE).                │
│             │ do, which asset are they touching, and    │                                          │
│             │ does immutable evidence exist?            │                                          │
│             │ This is our Trust Continuity Platform."   │                                          │
├─────────────┼───────────────────────────────────────────┼──────────────────────────────────────────┤
│ 0:20 – 0:50 │ "First, Step 1: Identity. In our on-chain │ Click 'Identities'.                      │
│             │ IdentityRegistry, Admin registers our     │ Point to Account 1: Engineer A.          │
│             │ employees. Notice Engineer A is registered│ Notice Status is ACTIVE and role is      │
│             │ and has MANAGER_ROLE."                    │ MANAGER.                                 │
├─────────────┼───────────────────────────────────────────┼──────────────────────────────────────────┤
│ 0:50 – 1:20 │ "Step 2: Governed Asset Minting. We switch│ Select 'Account 1: Engineer A' in dev    │
│             │ to Engineer A. As an active manager,      │ dropdown (or MetaMask). Go to Assets.    │
│             │ Engineer A mints asset BEL-TEST-1047.     │ Click 'Mint Governed Asset'.             │
│             │ Notice the browser computes SHA-256:      │ Show the document hash stored on-chain.  │
│             │ we store proof of the spec, not secrets." │                                          │
├─────────────┼───────────────────────────────────────────┼──────────────────────────────────────────┤
│ 1:20 – 1:40 │ "Step 3: Controlled Custody Transfer.     │ On Assets page, select Token #1047.      │
│             │ Engineer A reassigns custody to Engineer  │ Select New Custodian: Engineer B.        │
│             │ B. Standard NFT transfers are disabled:   │ Click 'Transfer Custody'.                │
│             │ custody change is strictly an authorized  │ Point to updated custodian in table:     │
│             │ governance action."                       │ 'Engineer B'.                            │
├─────────────┼───────────────────────────────────────────┼──────────────────────────────────────────┤
│ 1:40 – 2:10 │ "Now, the core security innovation.       │ Switch account to Account 0 (Admin).     │
│             │ Suppose Engineer A is reassigned or       │ Go to Identities page.                   │
│             │ suspended. Admin clicks REVOKE.           │ Click 'Revoke' on Engineer A.            │
│             │ Engineer A's identity is now inactive.    │ Status badge turns red: REVOKED.         │
│             │ But notice: Engineer A still holds        │ Point out: MANAGER_ROLE still listed.    │
│             │ MANAGER_ROLE in AccessControl!"           │                                          │
├─────────────┼───────────────────────────────────────────┼──────────────────────────────────────────┤
│ 2:10 – 2:30 │ "Step 5: Revocation Attack Demo.          │ Navigate to 'Security Demo'.             │
│             │ Engineer A tries to perform a manager     │ Under ATTACK SCENARIO 2, click:          │
│             │ mint. The frontend does not fake this.    │ 'Attempt Mint as Engineer A'.            │
│             │ The smart contract evaluates the rule,    │ Screen shows big red banner:             │
│             │ halts execution, and REVERTS!"            │ ACCESS DENIED — SMART CONTRACT REVERTED. │
│             │                                           │ Technical Reason: IdentityNotActive().   │
├─────────────┼───────────────────────────────────────────┼──────────────────────────────────────────┤
│ 2:30 – 2:45 │ "Next, Attack 1: Horizontal RBAC.         │ Under ATTACK SCENARIO 1, click:          │
│             │ Engineer B (an active user) attempts a    │ 'Execute Real Attack Transaction'.       │
│             │ manager custody transfer. Once again,     │ Screen shows red banner:                 │
│             │ the smart contract halts and REVERTS."    │ ATTACK BLOCKED — NotManager().           │
├─────────────┼───────────────────────────────────────────┼──────────────────────────────────────────┤
│ 2:45 – 3:00 │ "Finally, Step 7: The Evidence Trail.     │ Navigate to 'Audit History'.             │
│             │ An auditor views the complete chronological│ Point to the chronological table:        │
│             │ record: Identity Registered, Minted,      │ - Identity Registered                    │
│             │ Custody Transferred, Revocation, and      │ - Asset Minted                           │
│             │ Blocked Attacks with exact tx hashes.     │ - Custody Transferred                    │
│             │ No administrator can silently rewrite this│ - Identity Revoked                       │
│             │ history. That is Trust Continuity."       │ - Attack Blocked                         │
└─────────────┴───────────────────────────────────────────┴──────────────────────────────────────────┘
```

---

### 3. Pre-Demo Setup Checklist (2 Minutes Before Presenting)

1. Open Terminal 1:
   ```bash
   cd trust-continuity
   npx hardhat node
   ```
2. Open Terminal 2:
   ```bash
   cd trust-continuity
   npx hardhat run scripts/deploy.ts --network localhost
   ```
3. Open Terminal 3:
   ```bash
   cd trust-continuity/frontend
   npm run dev
   ```
4. Open browser at `http://localhost:3000`.
5. Ensure demo account dropdown is set to **Account 0 [ADMIN]**.

---

### 4. Anticipated Judge Questions & Quick Answers

- **Q: "Why did you use Hardhat local network instead of Ethereum mainnet?"**
  - **A**: "For enterprise defense use-cases, public networks create unacceptable latency, gas volatility, and information leakage. The local node simulates an on-premises permissioned consortium chain suitable for BEL facilities."

- **Q: "What prevents an admin from stealing assets?"**
  - **A**: "Admin holds `DEFAULT_ADMIN_ROLE`, but only accounts with `MANAGER_ROLE` and an active identity can mint or transfer assets. Furthermore, all admin actions emit tamper-evident events."

- **Q: "What is your novel innovation?"**
  - **A**: "Connecting identity status and role authorization into a single smart-contract condition. In conventional systems, revoking an employee often leaves stale roles. In our system, revocation instantly blocks operations at the EVM consensus layer."
