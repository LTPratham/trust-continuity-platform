"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "../../lib/WalletContext";
import {
  getReadOnlyContracts,
  DEMO_ACCOUNTS,
  ROLE_HASHES,
} from "../../lib/contracts";
import {
  History,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Filter,
  RefreshCw,
  Clock,
  User,
  FileBox,
} from "lucide-react";

interface AuditEntry {
  id: string;
  blockNumber: number;
  timestamp: string;
  action: string;
  actor: string;
  actorLabel: string;
  target?: string;
  targetLabel?: string;
  assetId?: string;
  result: "SUCCESS" | "BLOCKED";
  txHash: string;
  details: string;
}

export default function AuditPage() {
  const { currentAccount } = useWallet();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const getAccountLabel = (address: string) => {
    if (!address) return "System";
    const found = DEMO_ACCOUNTS.find(
      (a) => a.address.toLowerCase() === address.toLowerCase()
    );
    return found ? found.label : `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const loadAuditHistory = useCallback(async () => {
    try {
      setLoading(true);
      const { identityRegistry, assetNFT, provider } = getReadOnlyContracts();

      const auditList: AuditEntry[] = [];

      // 1. IdentityRegistry events
      const regFilter = identityRegistry.filters.IdentityRegistered();
      const revFilter = identityRegistry.filters.IdentityRevoked();
      const reactFilter = identityRegistry.filters.IdentityReactivated();

      const [regEvents, revEvents, reactEvents] = await Promise.all([
        identityRegistry.queryFilter(regFilter, 0, "latest"),
        identityRegistry.queryFilter(revFilter, 0, "latest"),
        identityRegistry.queryFilter(reactFilter, 0, "latest"),
      ]);

      for (const ev of regEvents) {
        const block = await provider.getBlock(ev.blockNumber);
        const target = (ev as any).args?.[0] || "";
        auditList.push({
          id: `reg-${ev.transactionHash}-${ev.index}`,
          blockNumber: ev.blockNumber,
          timestamp: block ? new Date(block.timestamp * 1000).toLocaleTimeString() : "Recent",
          action: "Identity Registered",
          actor: "Admin",
          actorLabel: "Administrator",
          target,
          targetLabel: getAccountLabel(target),
          result: "SUCCESS",
          txHash: ev.transactionHash,
          details: `Registered organizational identity: ${getAccountLabel(target)}`,
        });
      }

      for (const ev of revEvents) {
        const block = await provider.getBlock(ev.blockNumber);
        const target = (ev as any).args?.[0] || "";
        auditList.push({
          id: `rev-${ev.transactionHash}-${ev.index}`,
          blockNumber: ev.blockNumber,
          timestamp: block ? new Date(block.timestamp * 1000).toLocaleTimeString() : "Recent",
          action: "Identity Revoked",
          actor: "Admin",
          actorLabel: "Administrator",
          target,
          targetLabel: getAccountLabel(target),
          result: "SUCCESS",
          txHash: ev.transactionHash,
          details: `Revoked organizational identity: ${getAccountLabel(target)}`,
        });
      }

      for (const ev of reactEvents) {
        const block = await provider.getBlock(ev.blockNumber);
        const target = (ev as any).args?.[0] || "";
        auditList.push({
          id: `react-${ev.transactionHash}-${ev.index}`,
          blockNumber: ev.blockNumber,
          timestamp: block ? new Date(block.timestamp * 1000).toLocaleTimeString() : "Recent",
          action: "Identity Reactivated",
          actor: "Admin",
          actorLabel: "Administrator",
          target,
          targetLabel: getAccountLabel(target),
          result: "SUCCESS",
          txHash: ev.transactionHash,
          details: `Reactivated organizational identity: ${getAccountLabel(target)}`,
        });
      }

      // 2. AssetNFT events
      const mintFilter = assetNFT.filters.AssetMinted();
      const transferFilter = assetNFT.filters.CustodyTransferred();

      const [mintEvents, transferEvents] = await Promise.all([
        assetNFT.queryFilter(mintFilter, 0, "latest"),
        assetNFT.queryFilter(transferFilter, 0, "latest"),
      ]);

      for (const ev of mintEvents) {
        const block = await provider.getBlock(ev.blockNumber);
        const tokenId = (ev as any).args?.[0];
        const assetId = (ev as any).args?.[1];
        const custodian = (ev as any).args?.[2];
        const creator = (ev as any).args?.[3];
        auditList.push({
          id: `mint-${ev.transactionHash}-${ev.index}`,
          blockNumber: ev.blockNumber,
          timestamp: block ? new Date(block.timestamp * 1000).toLocaleTimeString() : "Recent",
          action: "Asset Minted",
          actor: creator,
          actorLabel: getAccountLabel(creator),
          target: custodian,
          targetLabel: getAccountLabel(custodian),
          assetId: `${assetId} (#${tokenId})`,
          result: "SUCCESS",
          txHash: ev.transactionHash,
          details: `Minted governed asset record ${assetId} (Token #${tokenId}) to custodian ${getAccountLabel(custodian)}`,
        });
      }

      for (const ev of transferEvents) {
        const block = await provider.getBlock(ev.blockNumber);
        const tokenId = (ev as any).args?.[0];
        const from = (ev as any).args?.[1];
        const to = (ev as any).args?.[2];
        const transferredBy = (ev as any).args?.[3];
        auditList.push({
          id: `trans-${ev.transactionHash}-${ev.index}`,
          blockNumber: ev.blockNumber,
          timestamp: block ? new Date(block.timestamp * 1000).toLocaleTimeString() : "Recent",
          action: "Custody Transferred",
          actor: transferredBy,
          actorLabel: getAccountLabel(transferredBy),
          target: to,
          targetLabel: `${getAccountLabel(from)} → ${getAccountLabel(to)}`,
          assetId: `Token #${tokenId}`,
          result: "SUCCESS",
          txHash: ev.transactionHash,
          details: `Custody re-assigned from ${getAccountLabel(from)} to ${getAccountLabel(to)} by Manager`,
        });
      }

      // Check local storage for blocked attack attempts captured during live demo
      if (typeof window !== "undefined") {
        const blockedLogs = JSON.parse(localStorage.getItem("tc_blocked_attacks") || "[]");
        for (const item of blockedLogs) {
          auditList.push({
            id: item.id,
            blockNumber: item.blockNumber || 0,
            timestamp: item.timestamp,
            action: item.action,
            actor: item.actor,
            actorLabel: getAccountLabel(item.actor),
            target: item.target,
            targetLabel: item.target ? getAccountLabel(item.target) : "AssetNFT",
            assetId: item.assetId,
            result: "BLOCKED",
            txHash: item.txHash || "0x[Smart Contract Revert - No State Written]",
            details: item.details,
          });
        }
      }

      // Sort chronological descending
      auditList.sort((a, b) => b.blockNumber - a.blockNumber);
      setEntries(auditList);
    } catch (err) {
      console.error("Error loading audit history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuditHistory();
  }, [loadAuditHistory, currentAccount]);

  // Filter entries
  const filteredEntries = entries.filter((e) => {
    if (filterAction !== "ALL" && e.action !== filterAction) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        e.action.toLowerCase().includes(term) ||
        e.actorLabel.toLowerCase().includes(term) ||
        (e.targetLabel && e.targetLabel.toLowerCase().includes(term)) ||
        (e.assetId && e.assetId.toLowerCase().includes(term)) ||
        e.details.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-teal-700" />
            Immutable Audit Trail & Cryptographic Evidence
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Reconstructed directly from on-chain smart contract events. No database administrator can silently alter or purge history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAuditHistory}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 flex items-center gap-1.5 shadow-xs transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Ledger</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="ALL">All Actions & Events</option>
            <option value="Identity Registered">Identity Registered</option>
            <option value="Identity Revoked">Identity Revoked</option>
            <option value="Identity Reactivated">Identity Reactivated</option>
            <option value="Role Granted">Role Granted</option>
            <option value="Role Revoked">Role Revoked</option>
            <option value="Asset Minted">Asset Minted</option>
            <option value="Custody Transferred">Custody Transferred</option>
            <option value="Unauthorized Custody Transfer Attempt">Unauthorized Actions (Blocked)</option>
            <option value="Revoked Identity Action Attempt">Revoked Actions (Blocked)</option>
          </select>
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search actor, asset, or event..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Time</th>
                <th className="px-5 py-3 text-left">Action</th>
                <th className="px-5 py-3 text-left">Actor / Initiator</th>
                <th className="px-5 py-3 text-left">Target / Custody</th>
                <th className="px-5 py-3 text-left">Governed Asset</th>
                <th className="px-5 py-3 text-center">Result</th>
                <th className="px-5 py-3 text-left">Evidence / Tx Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    Querying on-chain blockchain event logs...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    No events match the current filter.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((ev) => (
                  <tr
                    key={ev.id}
                    className={`transition-colors ${
                      ev.result === "BLOCKED"
                        ? "bg-red-50/50 hover:bg-red-50"
                        : "hover:bg-slate-50/80"
                    }`}
                  >
                    {/* Time */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {ev.timestamp}
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                      {ev.action}
                    </td>

                    {/* Actor */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-800 font-medium">
                      {ev.actorLabel}
                    </td>

                    {/* Target */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-700">
                      {ev.targetLabel || "—"}
                    </td>

                    {/* Asset */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-blue-800 font-semibold">
                      {ev.assetId || "—"}
                    </td>

                    {/* Result */}
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      {ev.result === "SUCCESS" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-700" />
                          SUCCESS
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                          <ShieldAlert className="w-3 h-3 mr-1 text-red-700" />
                          BLOCKED
                        </span>
                      )}
                    </td>

                    {/* Tx Hash */}
                    <td className="px-5 py-3.5 font-mono text-[11px]">
                      {ev.txHash.startsWith("0x") && ev.txHash.length === 66 ? (
                        <span className="text-teal-700 font-semibold" title={ev.txHash}>
                          {ev.txHash.slice(0, 8)}...{ev.txHash.slice(-6)}
                        </span>
                      ) : (
                        <span className="text-red-700 font-bold">{ev.txHash}</span>
                      )}
                      <div className="text-[10px] text-slate-500 max-w-xs truncate">
                        {ev.details}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
