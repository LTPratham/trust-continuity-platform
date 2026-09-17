# Backend Security & Privileged Access --- Production-Grade Updation

## SIH26125 --- Trust Continuity Platform

> **Purpose:** This document contains two security architecture
> suggestions for the team, focused on the two major risks we
> identified: **(1) unauthorized/internal database modification** and
> **(2) privileged-admin access / sensitive-file leakage**.

------------------------------------------------------------------------

# 1. First: How This Fits Our Existing Project

Our current SIH26125 architecture already connects:

**Identity → Permission → Asset → Action Enforcement → Evidence**

The current design uses `IdentityRegistry.sol`, role-based access
control, `AssetNFT.sol`, active-identity checks, controlled custody
transfer, blockchain events and a dashboard. The important authorization
decision is made by the smart contract rather than only by the frontend.

The proposed backend/security additions should **strengthen this
architecture, not replace it**.

### Important architectural principle

**SQL should not become the ultimate authority for security-critical
state.**

SQL can store:

-   user/profile metadata
-   asset metadata
-   dashboard/indexing data
-   document metadata
-   investigation/evidence references
-   application state that does not need independent enforcement

But critical authorization/custody state should remain independently
verifiable through the blockchain/smart-contract layer.

------------------------------------------------------------------------

# 2. The Major Problem We Need to Solve

## Problem A --- What if an internal person directly changes MySQL?

Example:

An authorized application admin changes an asset through the dashboard.

That is an expected change.

But suppose an internal DBA, compromised server account, or attacker
with database credentials directly executes:

``` sql
UPDATE assets
SET custodian_id = 'attacker'
WHERE asset_id = 'BEL-TEST-1047';
```

The application may never see this request.

A normal application audit log may therefore show no corresponding
action.

This is exactly the trust problem our project is trying to address: an
organization should be able to independently answer:

-   Who changed it?
-   Was that change authorized?
-   What was the previous value?
-   What is the current value?
-   Did the application approve it?
-   Can the history be independently verified?

The existing project already identifies the rogue-DBA problem and the
need for a trustworthy history rather than relying only on an editable
database. fileciteturn1file2L20-L30

------------------------------------------------------------------------

# 3. Suggestion 1 --- Database Integrity Verification + Tamper-Evident Audit

## 3.1 Core idea

For every security-sensitive SQL record, generate a deterministic
cryptographic fingerprint.

Example:

``` text
Record:
asset_id = BEL-TEST-1047
custodian = engineerA
status = ACTIVE
classification = RESTRICTED
version = 14
```

Create a canonical representation:

``` text
asset_id|BEL-TEST-1047
custodian|engineerA
status|ACTIVE
classification|RESTRICTED
version|14
```

Then calculate:

``` text
SHA-256(canonical_record)
```

The resulting value becomes the record's integrity fingerprint.

### But one important correction

**Do NOT store the only reference hash in the same MySQL database.**

If the attacker can modify MySQL, they could change:

``` text
database record
+
database hash
```

and make the two match again.

Therefore, the trusted baseline must exist outside the database.

------------------------------------------------------------------------

# 4. Production Architecture for Database Integrity

``` text
                 APPROVED APPLICATION CHANGE
                           |
                           v
                    Backend API
                           |
             +-------------+-------------+
             |                           |
             v                           v
        MySQL record              Security Audit Event
             |                           |
             v                           v
       Canonical Hash              Hash-chain entry
             |                           |
             +-------------+-------------+
                           |
                           v
                 Integrity Manifest
                           |
                 +---------+---------+
                 |                   |
                 v                   v
          Blockchain Anchor     Immutable/WORM Store
```

## 4.1 What happens after every legitimate edit?

Example:

Admin changes asset custody through the dashboard.

### Step 1 --- Authenticate

Admin passes:

-   account authentication
-   role check
-   required step-up authentication
-   device/access policy

### Step 2 --- Authorize

Backend verifies that the requested operation is allowed.

For blockchain-controlled actions, the smart contract remains the final
enforcement boundary.

The project already defines the core rule:

``` text
Correct Role + Active Identity = Action May Proceed
Wrong Role OR Revoked Identity = Smart Contract Rejects Action
```

This should remain the foundation. fileciteturn2file1L268-L280

### Step 3 --- Perform SQL transaction

Update the database.

### Step 4 --- Generate integrity hash

Calculate the hash of the resulting canonical record.

### Step 5 --- Create audit event

Store:

``` text
event_id
timestamp
actor_id
actor_role
action
resource_id
old_hash
new_hash
request_id
device_id
source_ip
result
transaction_hash (if blockchain action)
previous_audit_hash
current_audit_hash
```

### Step 6 --- Anchor integrity proof externally

Periodically anchor a hash/Merkle root to:

-   blockchain, and/or
-   an independent immutable/WORM storage system.

This prevents the database from being the only place where the evidence
exists.

------------------------------------------------------------------------

# 5. What About the 5-Minute Cron Job?

The team's proposed idea:

> Every 5 minutes, compare the current database hash with the trusted
> hash. If they don't match, alert the owner/admin.

**This is useful, but it is detective control, not preventive control.**

### Recommended design

Use **two layers**:

### Layer 1 --- Event-driven detection

Whenever possible, detect changes immediately through:

-   application audit events
-   database change data capture
-   database audit mechanisms
-   integrity-monitoring agent

### Layer 2 --- 5-minute reconciliation

Every 5 minutes:

``` text
Read security-sensitive records
        ↓
Recalculate hashes
        ↓
Compare against trusted manifest
        ↓
Mismatch?
   /          \
 YES           NO
 |              |
Alert +          Continue
Freeze +
Incident event
```

The 5-minute job becomes a **backstop** in case an attacker bypasses the
normal application path.

------------------------------------------------------------------------

# 6. What Happens When a Hash Mismatch Is Detected?

Example:

``` text
Expected hash:
8d31...92af

Current database hash:
91bc...4412

STATUS:
INTEGRITY VIOLATION
```

The system should automatically:

1.  Create a high-severity security incident.
2.  Record the affected table/record.
3.  Record old trusted hash and observed hash.
4.  Record detection timestamp.
5.  Identify the last legitimate application event.
6.  Identify the last known database change where possible.
7.  Alert the security owner.
8.  Mark the affected object as **QUARANTINED / INTEGRITY COMPROMISED**.
9.  Prevent further sensitive operations on that object until reviewed.
10. Preserve the evidence externally.

### Important

Do not automatically "repair" the database immediately.

First preserve evidence.

Otherwise, an automatic rollback could destroy forensic information.

------------------------------------------------------------------------

# 7. The More Important Part --- Protecting the Audit Logs

This is where simple hashing is not enough.

Suppose an attacker gets root/server access.

They could potentially change:

``` text
users
assets
audit_logs
hashes
```

Therefore:

**Hashing logs inside the same server does NOT provide sufficient
protection against a fully compromised server.**

------------------------------------------------------------------------

# 8. Hash-Chain Audit Log

Every audit event should contain the hash of the previous event.

Example:

``` text
Event 101
previous_hash = H100
event_hash    = H101

Event 102
previous_hash = H101
event_hash    = H102

Event 103
previous_hash = H102
event_hash    = H103
```

Conceptually:

``` text
H100 → H101 → H102 → H103 → H104
```

If an attacker modifies Event 102:

``` text
H102 changes
   ↓
H103 no longer matches
   ↓
H104 no longer matches
   ↓
integrity verification fails
```

This provides tamper evidence.

------------------------------------------------------------------------

# 9. But Hash-Chaining Alone Is Still Not Enough

An attacker with complete server control could theoretically rewrite the
entire chain.

Therefore the final protection is:

## External anchoring

Periodically calculate:

``` text
Merkle Root / Audit Root
```

and anchor it outside the compromised server.

Possible architecture:

``` text
Application Logs
      ↓
Hash Chain
      ↓
Merkle Tree
      ↓
Merkle Root
      ↓
Blockchain / Independent Immutable Store
```

Now the attacker cannot silently rewrite the complete server-side audit
history without creating a mismatch against the external anchor.

This directly complements the project's existing blockchain
event-history model. The current project already uses blockchain events
as independently checkable lifecycle evidence.
fileciteturn1file3L206-L217

------------------------------------------------------------------------

# 10. Suggestion 1 --- Final Security Stack

``` text
                 DATABASE INTEGRITY
                         |
        +----------------+----------------+
        |                |                |
        v                v                v
   Record Hash       Audit Hash Chain   DB Change Detection
        |                |                |
        +----------------+----------------+
                         |
                         v
                    Merkle Root
                         |
              +----------+----------+
              |                     |
              v                     v
       Blockchain Anchor      WORM/Immutable Store
              |
              v
       Independent Verification
```

### Result

If someone changes MySQL directly:

``` text
Unauthorized SQL Change
        ↓
Hash mismatch
        ↓
Integrity alert
        ↓
Incident created
        ↓
Sensitive object quarantined
        ↓
Owner/Security team notified
        ↓
Evidence preserved
```

------------------------------------------------------------------------

# 11. Suggestion 2 --- Privileged Admin Access + Secure Vault + Browser Extension

The second suggestion is for the sensitive admin panel and high-value
files.

The objective is:

> **Even if an attacker obtains normal application credentials, they
> should still not automatically receive privileged admin access or a
> downloadable sensitive file.**

The project's current roles are `ADMIN`, `MANAGER`, `AUDITOR`, and
`USER`, with the smart contract enforcing privileged operations.
fileciteturn2file1L259-L275

We can add a separate **Privileged Access Security Layer** around the
admin interface.

------------------------------------------------------------------------

# 12. Secure Vault --- File Access Flow

Sensitive files should not have a permanent public URL.

Avoid:

``` text
https://server.com/files/secret.pdf
```

Instead:

``` text
User
 ↓
Open File
 ↓
Step-Up Authentication
 ↓
Authorization Check
 ↓
One-Time Token
 ↓
Short-Lived Access
 ↓
Secure Download/Streaming
 ↓
Token Destroyed
```

------------------------------------------------------------------------

# 13. Proposed 15-Minute Tokenized Access

When the user clicks:

**OPEN / REQUEST ACCESS**

the backend creates:

``` text
access_token
file_id
user_id
device_id
issued_at
expires_at
nonce
scope = DOWNLOAD
one_time = true
```

Example:

``` text
TTL = 15 minutes
```

The user receives a time-limited link through the registered email.

### Important

The email link should NOT itself be the entire security decision.

The backend must verify:

-   token validity
-   expiry
-   user identity
-   device/session binding
-   requested file
-   user authorization
-   one-time-use state

------------------------------------------------------------------------

# 14. Email + PIN

The proposed flow:

``` text
Open
 ↓
Email possession / tokenized link
 ↓
User enters personal PIN
 ↓
Access granted
```

This combines:

-   **Possession factor:** registered email/session
-   **Knowledge factor:** PIN

However, for production, we should prefer a phishing-resistant factor
such as **WebAuthn/passkey/security key** for the highest-risk
administrator actions.

The PIN can remain as an additional recovery/step-up mechanism if policy
permits.

------------------------------------------------------------------------

# 15. File Encryption

The vault should not rely only on the web application hiding the
download button.

Sensitive files should be encrypted at rest.

Recommended model:

``` text
Sensitive File
     ↓
Generate unique Data Encryption Key (DEK)
     ↓
AES-256-GCM encryption
     ↓
Encrypted file stored in vault
     ↓
DEK protected by KMS/HSM
```

The application should never expose a permanent raw storage path.

When authorized:

``` text
User authentication
      ↓
Authorization
      ↓
Short-lived access token
      ↓
Server-side secure retrieval
      ↓
Decrypt/stream
```

------------------------------------------------------------------------

# 16. Critical Rule: No Permanent Download URL

Bad:

``` text
Download URL → permanent
```

Better:

``` text
Request
 ↓
Authorize
 ↓
Generate signed/one-time URL
 ↓
15-minute expiry
 ↓
Single use
 ↓
Invalidate
```

Even better for highly sensitive files:

``` text
Authorized session
 ↓
Server-side stream
 ↓
No reusable object URL
```

Every file-access event should be audited.

------------------------------------------------------------------------

# 17. Browser Extension as a Privileged Access Layer

The team's idea is to give each administrator a role-specific browser
extension so that:

> Without the authorized extension, the admin panel cannot be accessed.

This is a good **additional control**, but the extension itself should
NOT be treated as a magical hardware key.

A browser extension can potentially be:

-   disabled
-   removed
-   modified
-   copied
-   run inside a compromised browser profile
-   affected by browser/OS compromise

Therefore the production-grade implementation should be:

## Extension + Cryptographic Device Identity

The extension becomes a **cryptographic proof-of-presence mechanism**,
not just a secret extension file.

------------------------------------------------------------------------

# 18. Extension Enrollment

When a new privileged account is created:

``` text
Admin creates account
        ↓
Security enrollment
        ↓
Authorized extension installed
        ↓
Extension generates device key pair
        ↓
Private key remains non-exportable where platform support permits
        ↓
Public key registered with backend
        ↓
Device becomes trusted
```

The backend stores:

``` text
user_id
role
device_id
public_key
extension_version
status
enrollment_time
last_seen
region/network policy
```

Do NOT store the private key on the server.

------------------------------------------------------------------------

# 19. Challenge-Response Authentication

When the administrator opens the privileged panel:

``` text
Browser
  ↓
Backend sends random challenge
  ↓
Extension receives challenge
  ↓
Extension signs challenge
  ↓
Backend verifies signature
  ↓
Device identity confirmed
```

Example:

``` text
challenge = random 256-bit nonce

signature = Sign(private_key, challenge)

backend:
Verify(public_key, challenge, signature)
```

This is substantially stronger than:

``` text
if extension_installed == true
```

because installation status is not itself cryptographic proof.

------------------------------------------------------------------------

# 20. Role-Specific Extension Policy

Each privileged role can have a policy.

Example:

``` text
ADMIN
 ├── Identity management
 ├── Governance
 ├── Sensitive vault
 └── High-risk operations

MANAGER
 ├── Asset operations
 └── Custody operations

AUDITOR
 ├── Read-only audit
 └── Evidence verification

USER
 └── Limited application access
```

The backend must still enforce authorization.

The extension should **never replace backend authorization**.

------------------------------------------------------------------------

# 21. One-Time Enrollment vs Permanent Extension

Instead of sending an extension package to every person manually:

### Recommended lifecycle

``` text
Account Created
      ↓
Enrollment Request
      ↓
Company/Security Approval
      ↓
Official Extension Installation
      ↓
Device Key Registration
      ↓
Activation
      ↓
Normal Use
```

If the device is lost or compromised:

``` text
Device Revocation
      ↓
Public key disabled
      ↓
Extension can no longer authenticate
      ↓
New device enrollment required
```

This is much cleaner than treating the extension file itself as a
secret.

------------------------------------------------------------------------

# 22. Region-Based Restriction

The proposed idea also includes region-based restrictions.

Do NOT depend only on:

``` text
IP address = allowed
```

because IP geolocation can be inaccurate and can be affected by VPNs,
proxies and enterprise network architecture.

Instead combine:

``` text
User identity
+
Role
+
Device identity
+
Network trust
+
Geographic policy
+
Time policy
+
Step-up authentication
```

Example:

``` text
ADMIN access permitted only when:

Active identity
AND
Trusted device
AND
Approved corporate network
AND
Allowed region
AND
Step-up authentication passed
```

For defense/enterprise deployment, managed-device certificates,
enterprise network zones and device posture checks are stronger controls
than IP geolocation alone.

------------------------------------------------------------------------

# 23. Admin Authentication --- Highest Security Level

For the most sensitive operations:

``` text
Username / SSO
      +
Trusted Device / Extension
      +
WebAuthn / Security Key / Passkey
      +
Role Check
      +
Active Identity Check
      +
Optional Iris Verification
      +
Risk / Context Policy
      ↓
Privileged Operation
```

The project's existing prototype already makes **active identity +
role** the contract-level authorization rule. These new controls should
sit before the privileged operation and should not weaken the
smart-contract check. fileciteturn2file1L268-L280

------------------------------------------------------------------------

# 24. Iris Authentication

The team has an invention disclosure describing an iris-shift
gesture-based biometric authentication mechanism using infrared-assisted
imaging.

The document describes:

-   identity verification
-   dynamic iris-shift gesture
-   infrared-assisted imaging
-   liveness-oriented behavioral verification
-   offline operation
-   encrypted biometric templates
-   post-election deletion

The disclosure is an **invention disclosure**, so we should not describe
it as a granted patent unless the legal status confirms that separately.
fileciteturn0file4L5-L13

For this platform, if iris authentication is integrated, use it as an
additional high-assurance factor rather than the only factor.

Example:

``` text
Admin Login
   ↓
Trusted Device
   ↓
Cryptographic Authentication
   ↓
Iris/Liveness Verification
   ↓
Role + Active Identity Check
   ↓
Privileged Access
```

------------------------------------------------------------------------

# 25. Complete Production-Grade Security Flow

``` text
                         USER
                           |
                           v
                  Login / Identity
                           |
                           v
                  Active Identity?
                     /          \
                   NO            YES
                   |              |
                BLOCK             v
                           Role Verification
                                  |
                                  v
                         Trusted Device?
                           /          \
                         NO            YES
                         |              |
                      BLOCK             v
                             Extension Challenge
                                  |
                                  v
                            Signature Valid?
                           /          \
                         NO            YES
                         |              |
                      BLOCK             v
                         Step-Up Authentication
                                  |
                                  v
                         Iris / WebAuthn
                         (High-Risk Action)
                                  |
                                  v
                         Policy / Region /
                         Network Check
                                  |
                                  v
                         Backend Authorization
                                  |
                                  v
                       Smart Contract Check
                                  |
                    +-------------+-------------+
                    |                           |
                  FAIL                         PASS
                    |                           |
                  BLOCK                         v
                                           Perform Action
                                                  |
                         +------------------------+------------------+
                         |                        |                 |
                         v                        v                 v
                       SQL                  Audit Event       Blockchain Event
                         |                        |                 |
                         v                        v                 v
                   Record Hash             Hash Chain         TX Hash
                         |                        |                 |
                         +------------------------+-----------------+
                                                  |
                                                  v
                                           Merkle Root
                                                  |
                                      +-----------+-----------+
                                      |                       |
                                      v                       v
                              Blockchain Anchor          WORM Storage
```

------------------------------------------------------------------------

# 26. Secure Vault Flow

``` text
User clicks OPEN
       ↓
Check active identity
       ↓
Check role
       ↓
Check trusted device
       ↓
Step-up authentication
       ↓
Generate one-time access token
       ↓
Email notification/link
       ↓
PIN / WebAuthn verification
       ↓
Check token:
  - valid?
  - not expired?
  - correct user?
  - correct device?
  - correct file?
  - unused?
       ↓
       YES
       ↓
Decrypt/stream file
       ↓
Audit "FILE_ACCESSED"
       ↓
Token invalidated
```

------------------------------------------------------------------------

# 27. What Happens If Someone Gets Server Access?

This is the key threat model.

## Attacker gets only database credentials

Expected result:

``` text
Can attempt SQL modification
        ↓
Integrity verification detects mismatch
        ↓
Alert + incident
        ↓
Blockchain/external evidence remains
```

## Attacker gets application-server access

Expected result:

``` text
Can attempt to modify application/database
        ↓
External audit/integrity controls detect changes
        ↓
Privileged cryptographic device authentication
still required for protected operations
        ↓
Sensitive files are not exposed through permanent URLs
```

## Attacker gets a normal employee password

Expected result:

``` text
Password alone
      ↓
Insufficient
      ↓
Trusted device + step-up authentication required
```

## Attacker gets an admin password

Expected result:

``` text
Admin password
      ↓
Still insufficient
      ↓
Trusted device challenge
+
strong second factor
+
active identity
+
role
+
policy
      ↓
Access only if all conditions pass
```

## Attacker modifies the frontend

Expected result:

``` text
Modified UI
     ↓
Cannot bypass backend authorization
     ↓
Cannot bypass smart-contract authorization
```

This matches the current project principle that the frontend is not the
final security boundary. fileciteturn2file2L319-L344

------------------------------------------------------------------------

# 28. What Happens If Someone Modifies the Audit Logs?

``` text
Original:

H100 → H101 → H102 → H103

Attacker changes H101

H100 → H101* → H102 → H103
             X
        verification fails
```

Then compare the current audit root with the externally anchored root:

``` text
Current Root != Anchored Root

          ↓

AUDIT INTEGRITY COMPROMISED
```

The system should immediately create a security incident.

------------------------------------------------------------------------

# 29. Separation of Trust

A major production principle:

**Do not put every security control under the same administrator.**

Recommended separation:

``` text
Application Admin
    ≠
Database Admin
    ≠
Security/Audit Admin
    ≠
Key Management Admin
```

For highly sensitive operations:

``` text
Admin A requests
        ↓
Admin B / Security approval
        ↓
Operation executed
```

For very high-risk governance actions, consider multi-person
approval/multisig.

This also aligns with the project's future production-hardening
direction, which already identifies key rotation, ABAC, multi-person
approval and external anchoring as future enhancements.
fileciteturn1file7L495-L526

------------------------------------------------------------------------

# 30. Recommended Data Classification

Not everything belongs on blockchain.

## On-chain

Keep only information that benefits from independent verification:

-   identity status / identifier
-   roles or role state required for enforcement
-   asset identifier
-   custody state
-   important state transitions
-   document/integrity hashes
-   audit anchors
-   transaction references

## Off-chain

Keep sensitive/high-volume information:

-   personal details
-   documents
-   large files
-   biometric templates
-   operational metadata
-   detailed application logs
-   encrypted vault objects

The current project documentation explicitly follows this principle:
sensitive information stays off-chain and hashes can be anchored for
integrity. fileciteturn2file1L268-L275

------------------------------------------------------------------------

# 31. Backend Components We Should Add

``` text
backend/
├── auth/
│   ├── identity verification
│   ├── role verification
│   └── step-up authentication
│
├── device-trust/
│   ├── device enrollment
│   ├── public-key registration
│   ├── challenge-response
│   └── device revocation
│
├── integrity/
│   ├── canonical serializer
│   ├── record hashing
│   ├── reconciliation worker
│   ├── Merkle tree/root
│   └── blockchain anchor
│
├── audit/
│   ├── append-only events
│   ├── hash chain
│   ├── integrity verification
│   └── incident creation
│
├── vault/
│   ├── encrypted object storage
│   ├── token issuance
│   ├── token validation
│   ├── secure streaming
│   └── access audit
│
├── policy/
│   ├── role policy
│   ├── device policy
│   ├── network policy
│   ├── region policy
│   └── high-risk action policy
│
└── monitoring/
    ├── security alerts
    ├── anomaly detection
    └── incident response
```

------------------------------------------------------------------------

# 32. Database Tables --- Suggested Security Metadata

Example:

``` text
asset_integrity
-----------------------------
asset_id
record_version
record_hash
previous_record_hash
last_verified_at
integrity_status
anchored_root_id
```

Audit:

``` text
security_audit_events
-----------------------------
event_id
timestamp
actor_id
actor_role
action
resource_type
resource_id
result
request_id
device_id
source_ip
previous_event_hash
event_hash
blockchain_tx_hash
```

Trusted device:

``` text
trusted_devices
-----------------------------
device_id
user_id
public_key
role
status
enrolled_at
revoked_at
last_seen_at
extension_version
```

Vault access:

``` text
vault_access_events
-----------------------------
event_id
user_id
file_id
device_id
token_id
access_type
timestamp
result
ip
```

------------------------------------------------------------------------

# 33. Incident Severity

Suggested levels:

### LOW

Normal failed login / rejected action.

### MEDIUM

Repeated authentication failures or suspicious device behavior.

### HIGH

Unauthorized role attempt, unexpected sensitive-record modification.

### CRITICAL

Integrity mismatch, audit-chain break, privileged device compromise, or
unauthorized sensitive-vault access.

Example:

``` text
CRITICAL SECURITY EVENT

Asset: BEL-TEST-1047
Expected Hash: ABC...
Observed Hash: XYZ...
Detected: 22:04:17
Source: MySQL integrity monitor

Action:
1. Object quarantined
2. Security owner alerted
3. Evidence preserved
4. Audit root verified
```

------------------------------------------------------------------------

# 34. Development Order

Do NOT try to build everything simultaneously.

## Phase 1 --- Existing blockchain core

Keep stable:

-   IdentityRegistry
-   AccessControl
-   AssetNFT
-   active-identity enforcement
-   custody transfer
-   events
-   existing security tests

The current prototype roadmap already places smart contracts and
security testing before backend/frontend integration.
fileciteturn1file4L339-L368

## Phase 2 --- Backend integrity

Build:

-   canonical record hashing
-   audit events
-   hash chain
-   reconciliation worker
-   integrity status
-   alerting

## Phase 3 --- External evidence

Build:

-   Merkle root
-   blockchain anchoring
-   immutable/WORM audit archive
-   independent verification page

## Phase 4 --- Secure Vault

Build:

-   encrypted storage
-   access authorization
-   one-time token
-   expiry
-   secure streaming
-   access audit

## Phase 5 --- Privileged Device Layer

Build:

-   extension enrollment
-   device key pair
-   challenge-response
-   device revocation
-   role/device binding

## Phase 6 --- High-Assurance Admin

Add:

-   WebAuthn/passkey/security key
-   network policy
-   device posture
-   region policy
-   optional iris/liveness verification
-   multi-person approval for critical operations

------------------------------------------------------------------------

# 35. Security Testing We Must Demonstrate

## Database attacks

-   Direct SQL modification
-   Direct deletion
-   Audit-row modification
-   Hash modification attempt
-   Bulk unauthorized update
-   Database rollback attempt
-   Missing audit event

Expected:

``` text
DETECTED
```

## Access attacks

-   Wrong role
-   Revoked identity
-   Stolen password without trusted device
-   Unregistered device
-   Revoked device
-   Expired token
-   Reused token
-   Wrong file ID with valid token
-   Token from another device
-   Unauthorized region/network
-   Modified frontend

Expected:

``` text
BLOCKED
```

The current project already requires tests for wrong-role users, revoked
managers, unauthorized role changes and visible lifecycle events; these
new tests extend that security boundary into the backend and
privileged-access layer. fileciteturn2file2L293-L307

------------------------------------------------------------------------

# 36. What We Should NOT Claim

Do not say:

> "Nobody can ever hack it."

Do not say:

> "The extension makes the system unhackable."

Do not say:

> "Hashing makes the database immutable."

Do not say:

> "IP geolocation guarantees location."

Do not say:

> "The file cannot leak."

Do not say:

> "100% secure."

The existing project documentation correctly states that the prototype
demonstrates specific security properties and does not claim absolute
security. fileciteturn2file2L341-L362

Instead say:

> **"The architecture is designed so that unauthorized changes become
> detectable, privileged operations require multiple independent
> controls, and sensitive evidence remains independently verifiable."**

------------------------------------------------------------------------

# 37. The Strongest Combined Story for Judges

Instead of presenting these as random extra security features, connect
everything to the original problem.

### Original question

``` text
WHO?
WHAT MAY THEY DO?
WHICH ASSET?
IS THE ACTION ALLOWED?
WHAT PROOF REMAINS?
```

### Extended backend security question

``` text
WHAT IF THE DATABASE IS ATTACKED?
WHAT IF THE SERVER IS COMPROMISED?
WHAT IF AN ADMIN PASSWORD IS STOLEN?
WHAT IF AUDIT LOGS ARE MODIFIED?
WHAT IF A SENSITIVE FILE URL LEAKS?
```

### Our answer

``` text
Identity
   ↓
Role
   ↓
Trusted Device
   ↓
Step-Up Authentication
   ↓
Policy
   ↓
Smart Contract Enforcement
   ↓
SQL / Application State
   ↓
Record Hash
   ↓
Audit Hash Chain
   ↓
External Anchor
   ↓
Immutable Evidence
```

This preserves the project's core innovation: identity, permission,
asset custody, enforcement and evidence remain connected in one
lifecycle. fileciteturn1file3L206-L217

------------------------------------------------------------------------

# 38. Final Recommended Architecture

``` text
                         ┌───────────────────────┐
                         │       USER/ADMIN      │
                         └───────────┬───────────┘
                                     │
                                     v
                         ┌───────────────────────┐
                         │ Identity + Session    │
                         └───────────┬───────────┘
                                     │
                                     v
                         ┌───────────────────────┐
                         │ Trusted Device        │
                         │ Extension Challenge   │
                         └───────────┬───────────┘
                                     │
                                     v
                         ┌───────────────────────┐
                         │ Step-Up Authentication│
                         │ WebAuthn / Iris       │
                         └───────────┬───────────┘
                                     │
                                     v
                         ┌───────────────────────┐
                         │ Policy Engine         │
                         │ Role + Device +       │
                         │ Network + Region      │
                         └───────────┬───────────┘
                                     │
                                     v
                         ┌───────────────────────┐
                         │ Backend API           │
                         └───────────┬───────────┘
                                     │
                       ┌─────────────┴─────────────┐
                       │                           │
                       v                           v
              ┌─────────────────┐       ┌──────────────────┐
              │ Smart Contracts │       │ MySQL / Metadata │
              │ IdentityRegistry│       └────────┬─────────┘
              │ AssetNFT/RBAC   │                │
              └────────┬────────┘                v
                       │                 ┌──────────────────┐
                       │                 │ Record Hashing   │
                       │                 └────────┬─────────┘
                       │                          │
                       v                          v
              Blockchain Events          Hash-Chain Audit
                       │                          │
                       │                          v
                       │                    Merkle Root
                       │                     /        \
                       │                    /          \
                       v                   v            v
                 TX Evidence       Blockchain      WORM/Immutable
                                    Anchor            Archive

                         SECURE VAULT
                              │
                              v
                     Encrypted File Storage
                              │
                              v
                     One-Time 15-Min Token
                              │
                              v
                     Authorized Stream/Download
                              │
                              v
                        Access Audit Event
```

------------------------------------------------------------------------

# 39. Final Team Decision

## Suggestion 1 --- Backend Integrity & Evidence

**Goal:** Detect and prove unauthorized direct database/server
manipulation.

### Must-have

-   Per-record canonical hashing
-   External trusted hash baseline
-   Hash-chain audit logs
-   5-minute reconciliation job
-   Event-driven detection where possible
-   Merkle-root generation
-   Blockchain/external anchoring
-   Immutable/WORM audit archive
-   Automatic incident creation
-   Integrity quarantine

### Key message

> **"Even if someone bypasses the application and changes the database
> directly, the system should be able to detect the inconsistency and
> preserve independent evidence of the original state."**

------------------------------------------------------------------------

## Suggestion 2 --- Privileged Admin Extension + Secure Vault

**Goal:** Reduce the impact of stolen credentials and prevent
casual/leaked access to sensitive files.

### Must-have

-   Role-based backend authorization
-   Trusted-device enrollment
-   Extension challenge-response
-   Device public-key registration
-   Device revocation
-   Step-up authentication
-   One-time 15-minute vault token
-   Token bound to user/device/file
-   Single-use token
-   Encrypted file storage
-   No permanent download URLs
-   Full vault access audit
-   Network/region policy as additional context
-   WebAuthn/passkey/security key for highest-risk operations
-   Optional iris/liveness layer

### Key message

> **"A password alone should not be enough to reach privileged
> administration or sensitive evidence."**

------------------------------------------------------------------------

# 40. The Most Important Technical Correction

The team should **not** implement the idea as:

``` text
MySQL
 ↓
hash
 ↓
MySQL
 ↓
cron
```

That is weak because the same compromised trust domain contains both the
data and its verification reference.

The stronger design is:

``` text
MySQL
 ↓
Canonical Hash
 ↓
Independent Integrity Manifest
 ↓
Hash Chain
 ↓
Merkle Root
 ↓
Blockchain / Immutable External Anchor
```

And for privileged access:

``` text
Password
 +
Trusted Device Cryptographic Proof
 +
Step-Up Authentication
 +
Role
 +
Policy
 +
Smart Contract Authorization
```

That is the version worth presenting as a **production-hardening
architecture**, while keeping the current MVP small enough to remain
demonstrable.

------------------------------------------------------------------------

# 41. Implementation Priority

  Priority   Feature                        Reason
  ---------- ------------------------------ -----------------------------------
  P0         Smart-contract authorization   Existing core security boundary
  P0         Identity revocation            Immediate access invalidation
  P0         Audit events                   Evidence
  P0         Record integrity hashing       Detect SQL manipulation
  P0         Hash-chain audit               Detect log modification
  P1         5-minute reconciliation        Backstop detection
  P1         External/Merkle anchoring      Protect against server compromise
  P1         Secure vault encryption        Protect sensitive files
  P1         One-time short-lived access    Reduce link leakage
  P1         Trusted-device enrollment      Strengthen privileged access
  P1         Extension challenge-response   Cryptographic device proof
  P2         WebAuthn/passkey               Phishing-resistant step-up
  P2         Network/region policy          Contextual restriction
  P2         Iris/liveness                  High-assurance additional factor
  P2         Multi-person approval          Critical governance actions

------------------------------------------------------------------------

# 42. Final One-Line Architecture

> **"We don't just prevent unauthorized actions at the application
> layer; we continuously verify the integrity of backend state, preserve
> independently verifiable evidence, and require cryptographically
> trusted devices plus step-up authentication for privileged access."**
