"use client";

import React from "react";
import { CheckCircle2, XCircle, Shield } from "lucide-react";

interface PermissionCell {
  allowed: boolean;
  note?: string;
}

interface PermissionRow {
  permission: string;
  description: string;
  contract: string;
  admin: PermissionCell;
  manager: PermissionCell;
  auditor: PermissionCell;
  user: PermissionCell;
}

const MATRIX: PermissionRow[] = [
  {
    permission: "Register Identity",
    description: "Add a new wallet to the Organizational Identity Registry",
    contract: "IdentityRegistry",
    admin: { allowed: true },
    manager: { allowed: false },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Revoke Identity",
    description: "Suspend an active identity (blocks all contract operations)",
    contract: "IdentityRegistry",
    admin: { allowed: true, note: "Cannot revoke self" },
    manager: { allowed: false },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Reactivate Identity",
    description: "Restore a previously revoked identity",
    contract: "IdentityRegistry",
    admin: { allowed: true },
    manager: { allowed: false },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Update Credential Hash",
    description: "Update the off-chain credential reference hash for an identity",
    contract: "IdentityRegistry",
    admin: { allowed: true },
    manager: { allowed: false },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Grant / Revoke Roles",
    description: "Assign or remove MANAGER, AUDITOR, USER roles",
    contract: "AssetNFT",
    admin: { allowed: true },
    manager: { allowed: false },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Mint Asset",
    description: "Create a new governed digital asset record (ERC-721 token)",
    contract: "AssetNFT",
    admin: { allowed: false, note: "Admin lacks MANAGER_ROLE by default" },
    manager: { allowed: true, note: "Identity must be active" },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Transfer Custody",
    description: "Reassign the current custodian of an asset (direct, not lifecycle)",
    contract: "AssetNFT",
    admin: { allowed: false },
    manager: { allowed: true, note: "Identity must be active; asset must not be SUSPENDED/REVOKED" },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Update Asset State",
    description: "Change the lifecycle state (REGISTERED, ALLOCATED, IN_CUSTODY, etc.)",
    contract: "AssetNFT",
    admin: { allowed: false },
    manager: { allowed: true, note: "Identity must be active" },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Attest Asset (Physical Binding)",
    description: "Submit a physical-digital binding attestation record",
    contract: "AssetNFT",
    admin: { allowed: false },
    manager: { allowed: true, note: "Identity must be active" },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Suspend / Unsuspend Asset",
    description: "Temporarily block all manager operations on an asset",
    contract: "AssetNFT",
    admin: { allowed: true },
    manager: { allowed: false },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Revoke / Decommission Asset",
    description: "Permanently decommission an asset (irreversible in demo)",
    contract: "AssetNFT",
    admin: { allowed: true },
    manager: { allowed: false },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Submit Attestation",
    description: "Record a physical-digital binding in AssetAttestation registry",
    contract: "AssetAttestation",
    admin: { allowed: true, note: "Has VERIFIER_ROLE by default" },
    manager: { allowed: true, note: "Granted VERIFIER_ROLE at deploy" },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Invalidate Attestation",
    description: "Mark an erroneous attestation as invalid (record preserved for audit)",
    contract: "AssetAttestation",
    admin: { allowed: true },
    manager: { allowed: false },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Request Transfer",
    description: "Initiate a 6-step governed transfer lifecycle",
    contract: "TransferLifecycle",
    admin: { allowed: false },
    manager: { allowed: true, note: "Identity must be active; asset must be transferable" },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Authorize Destination",
    description: "Step 4: Approve the destination wallet to receive the asset",
    contract: "TransferLifecycle",
    admin: { allowed: true },
    manager: { allowed: false },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Accept Transfer",
    description: "Step 5: Destination wallet accepts the incoming asset",
    contract: "TransferLifecycle",
    admin: { allowed: false },
    manager: { allowed: false, note: "Only destination address can accept" },
    auditor: { allowed: false },
    user: { allowed: true, note: "Only if this wallet is the declared destination" },
  },
  {
    permission: "Confirm & Execute Transfer",
    description: "Step 6: Manager executes on-chain custody change via lifecycle contract",
    contract: "TransferLifecycle",
    admin: { allowed: false },
    manager: { allowed: true, note: "Trust Continuity re-checked at execution" },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Reject Transfer",
    description: "Reject a transfer at any active stage with recorded reason",
    contract: "TransferLifecycle",
    admin: { allowed: true },
    manager: { allowed: true, note: "Must be active identity" },
    auditor: { allowed: false },
    user: { allowed: false },
  },
  {
    permission: "Read / View Any State",
    description: "View identities, asset data, attestations, transfers (read-only)",
    contract: "All",
    admin: { allowed: true },
    manager: { allowed: true },
    auditor: { allowed: true },
    user: { allowed: true },
  },
];

const ROLE_COLORS: Record<string, string> = {
  ADMIN:   "bg-red-50 text-red-800 border-red-200",
  MANAGER: "bg-blue-50 text-blue-800 border-blue-200",
  AUDITOR: "bg-amber-50 text-amber-800 border-amber-200",
  USER:    "bg-emerald-50 text-emerald-800 border-emerald-200",
};

function Cell({ cell }: { cell: PermissionCell }) {
  return (
    <td className="px-4 py-3 text-center align-top">
      <div className="flex flex-col items-center gap-1">
        {cell.allowed
          ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          : <XCircle className="w-4 h-4 text-slate-300" />}
        {cell.note && (
          <span className="text-[9px] text-slate-500 leading-tight text-center max-w-[80px]">{cell.note}</span>
        )}
      </div>
    </td>
  );
}

const CONTRACT_COLORS: Record<string, string> = {
  "IdentityRegistry": "bg-purple-50 text-purple-700 border-purple-200",
  "AssetNFT":         "bg-blue-50 text-blue-700 border-blue-200",
  "AssetAttestation": "bg-teal-50 text-teal-700 border-teal-200",
  "TransferLifecycle":"bg-orange-50 text-orange-700 border-orange-200",
  "All":              "bg-slate-100 text-slate-600 border-slate-200",
};

export default function RBACPage() {
  const groups = Array.from(new Set(MATRIX.map(r => r.contract)));

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-700" />
          RBAC Permission Matrix
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          Role-Based Access Control enforced at the smart contract level. Every MANAGER action also
          requires an <span className="font-bold">active identity</span> in IdentityRegistry (Trust Continuity dual-check).
          Roles are recorded on-chain and cannot be self-assigned.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(ROLE_COLORS).map(([role, cls]) => (
          <span key={role} className={`px-3 py-1 rounded-lg border font-bold ${cls}`}>{role}</span>
        ))}
        <span className="flex items-center gap-1 text-slate-600">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Allowed
        </span>
        <span className="flex items-center gap-1 text-slate-600">
          <XCircle className="w-4 h-4 text-slate-300" /> Not permitted
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left text-slate-700 font-bold uppercase tracking-wide">Permission</th>
                <th className="px-4 py-3 text-left text-slate-700 font-bold uppercase tracking-wide">Contract</th>
                <th className="px-4 py-3 text-center text-red-700 font-bold uppercase tracking-wide">ADMIN</th>
                <th className="px-4 py-3 text-center text-blue-700 font-bold uppercase tracking-wide">MANAGER</th>
                <th className="px-4 py-3 text-center text-amber-700 font-bold uppercase tracking-wide">AUDITOR</th>
                <th className="px-4 py-3 text-center text-emerald-700 font-bold uppercase tracking-wide">USER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MATRIX.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="px-5 py-3">
                    <div className="font-semibold text-slate-900">{row.permission}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{row.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${CONTRACT_COLORS[row.contract] || ""}`}>
                      {row.contract}
                    </span>
                  </td>
                  <Cell cell={row.admin} />
                  <Cell cell={row.manager} />
                  <Cell cell={row.auditor} />
                  <Cell cell={row.user} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RBAC enforcement note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800">
        <div className="font-bold mb-1">Smart Contract Enforcement</div>
        <p>All permissions are enforced via OpenZeppelin AccessControl in Solidity. Role checks occur inside
        the contract — no frontend-only gate can bypass them. The only way to circumvent RBAC is to hold the
        required role AND have an active identity (for MANAGER operations), which must be explicitly granted by
        the admin using an on-chain transaction.</p>
      </div>
    </div>
  );
}
