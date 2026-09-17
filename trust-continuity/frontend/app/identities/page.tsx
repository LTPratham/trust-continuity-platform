"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "../../lib/WalletContext";
import {
  getReadOnlyContracts,
  getContractsWithSigner,
  parseContractError,
  DEMO_ACCOUNTS,
  ROLE_HASHES,
} from "../../lib/contracts";
import {
  UserCheck,
  UserX,
  Shield,
  Key,
  PlusCircle,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from "lucide-react";

interface IdentityItem {
  address: string;
  label: string;
  isRegistered: boolean;
  isActive: boolean;
  roles: string[];
}

export default function IdentitiesPage() {
  const { currentAccount, signer, refreshAccountState } = useWallet();
  const [identities, setIdentities] = useState<IdentityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [customAddress, setCustomAddress] = useState("");
  const [selectedRole, setSelectedRole] = useState("MANAGER_ROLE");
  const [roleTargetAddress, setRoleTargetAddress] = useState("");

  // Action feedback modal / notification
  const [actionStatus, setActionStatus] = useState<{
    type: "success" | "error" | "info";
    title: string;
    message: string;
    technicalReason?: string;
    txHash?: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Load identities for all demo accounts
  const loadIdentities = useCallback(async () => {
    try {
      setLoading(true);
      const { identityRegistry, assetNFT } = getReadOnlyContracts();

      const items: IdentityItem[] = [];
      for (const acc of DEMO_ACCOUNTS) {
        const [isReg, isAct] = await Promise.all([
          identityRegistry.isRegistered(acc.address),
          identityRegistry.isActive(acc.address),
        ]);

        const [hasAdmin, hasManager, hasAuditor, hasUser] = await Promise.all([
          assetNFT.hasRole(ROLE_HASHES.ADMIN, acc.address),
          assetNFT.hasRole(ROLE_HASHES.MANAGER, acc.address),
          assetNFT.hasRole(ROLE_HASHES.AUDITOR, acc.address),
          assetNFT.hasRole(ROLE_HASHES.USER, acc.address),
        ]);

        const roles: string[] = [];
        if (hasAdmin) roles.push("ADMIN");
        if (hasManager) roles.push("MANAGER");
        if (hasAuditor) roles.push("AUDITOR");
        if (hasUser) roles.push("USER");

        items.push({
          address: acc.address,
          label: acc.label,
          isRegistered: isReg,
          isActive: isAct,
          roles,
        });
      }

      setIdentities(items);
    } catch (err) {
      console.error("Error loading identities:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIdentities();
  }, [loadIdentities, currentAccount]);

  // Execute Register Identity
  const handleRegister = async (targetAddress: string) => {
    if (!signer) return;
    try {
      setSubmitting(true);
      setActionStatus(null);
      const { identityRegistry } = getContractsWithSigner(signer);
      const tx = await identityRegistry.registerIdentity(targetAddress);
      const receipt = await tx.wait();

      setActionStatus({
        type: "success",
        title: "Identity Registered Successfully",
        message: `Address ${targetAddress.slice(0, 8)}... is now registered and active on-chain.`,
        txHash: receipt.hash,
      });

      await loadIdentities();
      await refreshAccountState();
    } catch (err: any) {
      const parsed = parseContractError(err);
      setActionStatus({
        type: "error",
        title: parsed.userMessage,
        message: "Smart contract rejected the registration transaction.",
        technicalReason: parsed.technicalReason,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Revoke Identity
  const handleRevoke = async (targetAddress: string, label: string) => {
    if (!signer) return;
    try {
      setSubmitting(true);
      setActionStatus(null);
      const { identityRegistry } = getContractsWithSigner(signer);
      const tx = await identityRegistry.revokeIdentity(targetAddress);
      const receipt = await tx.wait();

      setActionStatus({
        type: "success",
        title: `Identity Revoked: ${label}`,
        message: `Identity has been marked inactive on-chain. All smart-contract authorizations are now suspended.`,
        txHash: receipt.hash,
      });

      await loadIdentities();
      await refreshAccountState();
    } catch (err: any) {
      const parsed = parseContractError(err);
      setActionStatus({
        type: "error",
        title: parsed.userMessage,
        message: "Smart contract rejected the revocation transaction.",
        technicalReason: parsed.technicalReason,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Reactivate Identity
  const handleReactivate = async (targetAddress: string, label: string) => {
    if (!signer) return;
    try {
      setSubmitting(true);
      setActionStatus(null);
      const { identityRegistry } = getContractsWithSigner(signer);
      const tx = await identityRegistry.reactivateIdentity(targetAddress);
      const receipt = await tx.wait();

      setActionStatus({
        type: "success",
        title: `Identity Reactivated: ${label}`,
        message: `Identity is now active again on-chain. Organizational privileges are restored.`,
        txHash: receipt.hash,
      });

      await loadIdentities();
      await refreshAccountState();
    } catch (err: any) {
      const parsed = parseContractError(err);
      setActionStatus({
        type: "error",
        title: parsed.userMessage,
        message: "Smart contract rejected the reactivation transaction.",
        technicalReason: parsed.technicalReason,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Grant Role
  const handleGrantRole = async (targetAddress: string, roleName: string) => {
    if (!signer) return;
    try {
      setSubmitting(true);
      setActionStatus(null);
      const { assetNFT } = getContractsWithSigner(signer);
      const roleHash =
        roleName === "MANAGER_ROLE"
          ? ROLE_HASHES.MANAGER
          : roleName === "AUDITOR_ROLE"
          ? ROLE_HASHES.AUDITOR
          : ROLE_HASHES.USER;

      const tx = await assetNFT.grantRole(roleHash, targetAddress);
      const receipt = await tx.wait();

      setActionStatus({
        type: "success",
        title: `Role Granted: ${roleName}`,
        message: `Role successfully recorded on AssetNFT contract for ${targetAddress.slice(0, 8)}...`,
        txHash: receipt.hash,
      });

      await loadIdentities();
      await refreshAccountState();
    } catch (err: any) {
      const parsed = parseContractError(err);
      setActionStatus({
        type: "error",
        title: parsed.userMessage,
        message: "Smart contract rejected the role grant transaction.",
        technicalReason: parsed.technicalReason,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Revoke Role
  const handleRevokeRole = async (targetAddress: string, roleName: string) => {
    if (!signer) return;
    try {
      setSubmitting(true);
      setActionStatus(null);
      const { assetNFT } = getContractsWithSigner(signer);
      const roleHash =
        roleName === "MANAGER_ROLE"
          ? ROLE_HASHES.MANAGER
          : roleName === "AUDITOR_ROLE"
          ? ROLE_HASHES.AUDITOR
          : ROLE_HASHES.USER;

      const tx = await assetNFT.revokeRole(roleHash, targetAddress);
      const receipt = await tx.wait();

      setActionStatus({
        type: "success",
        title: `Role Revoked: ${roleName}`,
        message: `Role removed from ${targetAddress.slice(0, 8)}... on AssetNFT contract.`,
        txHash: receipt.hash,
      });

      await loadIdentities();
      await refreshAccountState();
    } catch (err: any) {
      const parsed = parseContractError(err);
      setActionStatus({
        type: "error",
        title: parsed.userMessage,
        message: "Smart contract rejected the role revocation transaction.",
        technicalReason: parsed.technicalReason,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = currentAccount.roles.includes("ADMIN");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-700" />
            Organizational Identity & Access Registry
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Anchored on-chain in <code className="font-mono text-blue-800 font-semibold">IdentityRegistry.sol</code> and{" "}
            <code className="font-mono text-blue-800 font-semibold">AssetNFT.sol (AccessControl)</code>.
          </p>
        </div>

        {/* Administrator Guidance Banner */}
        <div className="text-xs">
          {isAdmin ? (
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg font-semibold bg-purple-50 text-purple-900 border border-purple-200">
              <Key className="w-3.5 h-3.5 mr-1.5 text-purple-700" />
              Connected as Administrator (Can manage identities)
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg font-medium bg-slate-100 text-slate-700 border border-slate-300">
              <Lock className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
              Admin required for identity changes (Switch to Account 0)
            </span>
          )}
        </div>
      </div>

      {/* Transaction Feedback Banner */}
      {actionStatus && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            actionStatus.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          {actionStatus.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1 text-xs">
            <div className="font-bold text-sm text-slate-900">{actionStatus.title}</div>
            <div>{actionStatus.message}</div>
            {actionStatus.technicalReason && (
              <div className="font-mono text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200">
                Technical Reason: {actionStatus.technicalReason}
              </div>
            )}
            {actionStatus.txHash && (
              <div className="text-[11px] text-emerald-700 font-mono font-semibold">
                Tx Hash: {actionStatus.txHash}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Identities Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Governed Personnel & Addresses
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {identities.length} Entities Enrolled
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Entity / Label</th>
                <th className="px-5 py-3 text-left">Wallet Address</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-left">Assigned Roles</th>
                <th className="px-5 py-3 text-right">Governance Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    Querying on-chain identity registry...
                  </td>
                </tr>
              ) : (
                identities.map((item) => (
                  <tr key={item.address} className="hover:bg-slate-50/80 transition-colors">
                    {/* Label */}
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{item.label}</span>
                        {item.address.toLowerCase() === currentAccount.address.toLowerCase() && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded font-bold">
                            CURRENT
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Address */}
                    <td className="px-5 py-3.5 font-mono text-slate-600">
                      {item.address}
                    </td>

                    {/* Active/Revoked Status */}
                    <td className="px-5 py-3.5 text-center">
                      {item.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <UserCheck className="w-3 h-3 mr-1 text-emerald-700" />
                          ACTIVE
                        </span>
                      ) : item.isRegistered ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                          <UserX className="w-3 h-3 mr-1 text-red-700" />
                          REVOKED
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-300">
                          UNREGISTERED
                        </span>
                      )}
                    </td>

                    {/* Roles */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {item.roles.length > 0 ? (
                          item.roles.map((r) => (
                            <span
                              key={r}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                r === "ADMIN"
                                  ? "bg-purple-50 text-purple-800 border-purple-200"
                                  : r === "MANAGER"
                                  ? "bg-blue-50 text-blue-800 border-blue-200"
                                  : r === "AUDITOR"
                                  ? "bg-teal-50 text-teal-800 border-teal-200"
                                  : "bg-slate-100 text-slate-700 border-slate-300"
                              }`}
                            >
                              {r}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right space-x-1.5">
                      {!item.isRegistered ? (
                        <button
                          disabled={submitting}
                          onClick={() => handleRegister(item.address)}
                          className="px-2.5 py-1 rounded-md bg-blue-800 hover:bg-blue-900 text-white font-semibold text-[11px] transition-all disabled:opacity-50"
                        >
                          Register
                        </button>
                      ) : item.isActive ? (
                        <button
                          disabled={submitting}
                          onClick={() => handleRevoke(item.address, item.label)}
                          className="px-2.5 py-1 rounded-md bg-red-700 hover:bg-red-800 text-white font-semibold text-[11px] transition-all disabled:opacity-50"
                          title="Revoke this identity on-chain"
                        >
                          Revoke
                        </button>
                      ) : (
                        <button
                          disabled={submitting}
                          onClick={() => handleReactivate(item.address, item.label)}
                          className="px-2.5 py-1 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-[11px] transition-all disabled:opacity-50"
                          title="Reactivate this identity on-chain"
                        >
                          Reactivate
                        </button>
                      )}

                      {/* Quick Role Toggle */}
                      {item.roles.includes("MANAGER") ? (
                        <button
                          disabled={submitting}
                          onClick={() => handleRevokeRole(item.address, "MANAGER_ROLE")}
                          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-medium disabled:opacity-50"
                        >
                          Drop Manager
                        </button>
                      ) : (
                        <button
                          disabled={submitting}
                          onClick={() => handleGrantRole(item.address, "MANAGER_ROLE")}
                          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-medium disabled:opacity-50"
                        >
                          Make Manager
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Registration & Role Management Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Register Custom Identity */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-blue-700" />
            Register Custom Identity
          </h3>
          <p className="text-xs text-slate-600 mb-3">
            Register any Ethereum wallet address into the on-chain Identity Registry.
          </p>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="0x... Wallet Address"
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              disabled={submitting || !customAddress}
              onClick={() => handleRegister(customAddress)}
              className="w-full py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-semibold text-xs disabled:opacity-50 transition-all shadow-xs"
            >
              {submitting ? "Processing on-chain..." : "Register Identity via Smart Contract"}
            </button>
          </div>
        </div>

        {/* Grant Role Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
            <Key className="w-4 h-4 text-purple-700" />
            Assign Governance Role
          </h3>
          <p className="text-xs text-slate-600 mb-3">
            Assign MANAGER_ROLE, USER_ROLE, or AUDITOR_ROLE in AssetNFT.
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="MANAGER_ROLE">MANAGER</option>
                <option value="USER_ROLE">USER</option>
                <option value="AUDITOR_ROLE">AUDITOR</option>
              </select>

              <select
                value={roleTargetAddress}
                onChange={(e) => setRoleTargetAddress(e.target.value)}
                className="col-span-2 bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">-- Select Target Account --</option>
                {DEMO_ACCOUNTS.map((acc) => (
                  <option key={acc.address} value={acc.address}>
                    {acc.label} ({acc.address.slice(0, 6)}...)
                  </option>
                ))}
              </select>
            </div>

            <button
              disabled={submitting || !roleTargetAddress}
              onClick={() => handleGrantRole(roleTargetAddress, selectedRole)}
              className="w-full py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs disabled:opacity-50 transition-all shadow-xs"
            >
              {submitting ? "Processing on-chain..." : `Grant ${selectedRole.replace("_ROLE", "")} Role`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
