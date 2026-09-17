"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "../../lib/WalletContext";
import { getReadOnlyContracts, DEMO_ACCOUNTS, ROLE_HASHES } from "../../lib/contracts";
import { TrustChainLifecycle } from "../../components/TrustChainLifecycle";
import {
  Users,
  UserX,
  FileBox,
  Key,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Compass,
  FileText,
  Clock,
  ExternalLink,
  RotateCcw
} from "lucide-react";

export default function DashboardConsolePage() {
  const { currentAccount, refreshAccountState } = useWallet();
  const [stats, setStats] = useState({
    activeIdentities: 0,
    revokedIdentities: 0,
    totalAssets: 0,
    managersCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      setLoading(true);
      const { identityRegistry, assetNFT } = getReadOnlyContracts();
      const [active, revoked, total] = await Promise.all([
        identityRegistry.activeCount(),
        identityRegistry.revokedCount(),
        assetNFT.totalAssets(),
      ]);

      let managers = 0;
      for (const acc of DEMO_ACCOUNTS) {
        const hasMgr = await assetNFT.hasRole(ROLE_HASHES.MANAGER, acc.address);
        if (hasMgr) managers++;
      }

      setStats({
        activeIdentities: Number(active),
        revokedIdentities: Number(revoked),
        totalAssets: Number(total),
        managersCount: managers,
      });
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [currentAccount]);

  const triggerTour = () => {
    window.dispatchEvent(new Event("open-app-tour"));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              Operational Command Console
            </span>
            <span className="text-xs text-slate-500">Live Network State</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">
            Trust & Custody Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
            Real-time on-chain monitor for personnel identities, role enforcement, and digital asset custody at Bharat Electronics Limited (BEL).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={triggerTour}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors"
          >
            <Compass className="w-4 h-4 text-blue-700" />
            <span>Interactive Tour</span>
          </button>
          <button
            onClick={loadStats}
            className="inline-flex items-center space-x-1 px-3 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors"
            title="Refresh Blockchain Data"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Identities */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Active Identities</span>
            <Users className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {loading ? "..." : stats.activeIdentities}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 font-medium">
            Active in IdentityRegistry.sol
          </div>
        </div>

        {/* Revoked Identities */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Revoked Personnel</span>
            <UserX className="w-4 h-4 text-red-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-red-700">
            {loading ? "..." : stats.revokedIdentities}
          </div>
          <div className="text-[11px] text-red-700 mt-1 font-medium">
            Privileges blocked on-chain
          </div>
        </div>

        {/* Governed Assets */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Governed Assets</span>
            <FileBox className="w-4 h-4 text-blue-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {loading ? "..." : stats.totalAssets}
          </div>
          <div className="text-[11px] text-blue-700 mt-1 font-medium">
            Unique ERC-721 tokens
          </div>
        </div>

        {/* Custody Managers */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Custody Managers</span>
            <Key className="w-4 h-4 text-purple-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {loading ? "..." : stats.managersCount}
          </div>
          <div className="text-[11px] text-purple-700 mt-1 font-medium">
            Authorized for asset lifecycle
          </div>
        </div>
      </div>

      {/* Dynamic Trust Chain Lifecycle */}
      <TrustChainLifecycle />

      {/* Quick Navigation Panels */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link
          href="/identities"
          className="p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between text-blue-800 mb-2 font-bold text-xs">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                IDENTITIES & ROLES
              </span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Manage Personnel</h3>
            <p className="text-xs text-slate-600 mt-1">
              Enroll employees, assign Manager/Auditor roles, and execute instant on-chain revocations.
            </p>
          </div>
          <div className="text-[11px] font-semibold text-blue-800 mt-3">
            Open Registry →
          </div>
        </Link>

        <Link
          href="/assets"
          className="p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between text-blue-800 mb-2 font-bold text-xs">
              <span className="flex items-center gap-1.5">
                <FileBox className="w-4 h-4" />
                GOVERNED ASSETS
              </span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Hardware Custody</h3>
            <p className="text-xs text-slate-600 mt-1">
              Mint defense equipment with SHA-256 integrity hashes and transfer chain-of-custody.
            </p>
          </div>
          <div className="text-[11px] font-semibold text-blue-800 mt-3">
            Open Assets →
          </div>
        </Link>

        <Link
          href="/security"
          className="p-4 bg-red-50/50 rounded-xl border border-red-200 hover:border-red-300 hover:shadow-sm transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between text-red-700 mb-2 font-bold text-xs">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                SECURITY TEST
              </span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Live Attack Demo</h3>
            <p className="text-xs text-slate-600 mt-1">
              Test on-chain reverts with unauthorized attackers or revoked managers in real time.
            </p>
          </div>
          <div className="text-[11px] font-bold text-red-700 mt-3">
            Execute Attack Test →
          </div>
        </Link>

        <Link
          href="/audit"
          className="p-4 bg-white rounded-xl border border-slate-200 hover:border-teal-400 hover:shadow-sm transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between text-teal-800 mb-2 font-bold text-xs">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                AUDIT HISTORY
              </span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Immutable Evidence</h3>
            <p className="text-xs text-slate-600 mt-1">
              Inspect cryptographic blockchain event logs with transaction hashes and block numbers.
            </p>
          </div>
          <div className="text-[11px] font-semibold text-teal-800 mt-3">
            View Audit Log →
          </div>
        </Link>
      </div>
    </div>
  );
}
