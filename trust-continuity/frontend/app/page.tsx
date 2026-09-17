"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "../lib/WalletContext";
import { getReadOnlyContracts, DEMO_ACCOUNTS, ROLE_HASHES } from "../lib/contracts";
import { TrustChainLifecycle } from "../components/TrustChainLifecycle";
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  UserX,
  FileBox,
  Key,
  ArrowRight,
  CheckCircle2,
  PlayCircle,
  Compass,
  Layers,
  FileText,
  XCircle,
  Lock,
  ExternalLink,
  ChevronRight
} from "lucide-react";

export default function LandingPage() {
  const { currentAccount } = useWallet();
  const [stats, setStats] = useState({
    activeIdentities: 0,
    revokedIdentities: 0,
    totalAssets: 0,
    managersCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
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
        console.error("Failed to load platform stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [currentAccount]);

  const triggerTour = () => {
    window.dispatchEvent(new Event("open-app-tour"));
  };

  return (
    <div className="space-y-10 pb-16">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. HERO SECTION: Defense Problem Statement & Platform Intro  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-xs">
        <div className="max-w-4xl space-y-5">
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
              Smart India Hackathon 2026 — SIH26125
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
              Defense Partner: Bharat Electronics Limited (BEL)
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Continuous Trust & Cryptographic Asset Custody Platform
          </h1>

          {/* Subtitle / Plain English Explanation */}
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            A blockchain-anchored access control and digital custody system designed for defense electronics manufacturing. It guarantees that high-value hardware (such as radar modules and avionics) can only be minted, handled, or transferred by <strong className="text-slate-900 font-semibold">actively verified personnel</strong> whose authorization is validated on-chain at the exact millisecond of every transaction.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-semibold text-sm shadow-sm transition-colors gap-2"
            >
              <Layers className="w-4 h-4" />
              Launch Console / Dashboard
            </Link>

            <button
              onClick={triggerTour}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-300 shadow-xs transition-colors gap-2"
            >
              <Compass className="w-4 h-4 text-blue-700" />
              Start Interactive Walkthrough
            </button>

            <Link
              href="/security"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-800 font-semibold text-sm border border-red-200 transition-colors gap-2"
            >
              <ShieldAlert className="w-4 h-4 text-red-700" />
              Live Security Revert Demo
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. REAL-TIME ON-CHAIN HEALTH METRICS                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Active Identities</span>
            <Users className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {loading ? "..." : stats.activeIdentities}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verified in IdentityRegistry.sol
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Revoked Personnel</span>
            <UserX className="w-4 h-4 text-red-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-red-700">
            {loading ? "..." : stats.revokedIdentities}
          </div>
          <div className="text-[11px] text-red-700 mt-1 font-medium">
            Blocked instantly by smart contract
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Governed Hardware</span>
            <FileBox className="w-4 h-4 text-blue-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {loading ? "..." : stats.totalAssets}
          </div>
          <div className="text-[11px] text-blue-700 mt-1 font-medium">
            Unique ERC-721 digital control handles
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Custody Managers</span>
            <Key className="w-4 h-4 text-purple-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {loading ? "..." : stats.managersCount}
          </div>
          <div className="text-[11px] text-purple-700 mt-1 font-medium">
            Authorized for asset lifecycle operations
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. DYNAMIC TRUST CHAIN DIAGRAM                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <TrustChainLifecycle />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. THE DEFENSE PROBLEM VS. THE INNOVATION                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            The Critical Vulnerabilities in Defense IT Systems
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Why traditional corporate identity (LDAP / Active Directory) and central databases fail in high-assurance defense settings like Bharat Electronics Limited.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Problem 1 */}
          <div className="p-5 rounded-xl border border-red-200 bg-red-50/40 space-y-2">
            <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
              <XCircle className="w-4 h-4 text-red-700 shrink-0" />
              <span>1. Stale Role Retention</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              When an engineer transfers departments or is suspended, their account might be flagged in HR, but active authentication tokens, local testing keys, or role assignments linger across factory workstations for hours or days.
            </p>
          </div>

          {/* Problem 2 */}
          <div className="p-5 rounded-xl border border-red-200 bg-red-50/40 space-y-2">
            <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
              <XCircle className="w-4 h-4 text-red-700 shrink-0" />
              <span>2. Rogue Database Admin (DBA)</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              In conventional SQL systems, a malicious insider or compromised administrator with root access can execute <code className="bg-white px-1 py-0.5 rounded border border-red-300 font-mono text-red-800">UPDATE assets</code> or delete audit logs, eliminating all forensic evidence.
            </p>
          </div>

          {/* Problem 3 */}
          <div className="p-5 rounded-xl border border-red-200 bg-red-50/40 space-y-2">
            <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
              <XCircle className="w-4 h-4 text-red-700 shrink-0" />
              <span>3. Broken Hardware Custody Trail</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Radar components and cryptographic modules move between cleanrooms, test benches, and deployment depots. Paper records or modifiable databases cannot mathematically prove chain-of-custody.
            </p>
          </div>
        </div>

        {/* How our smart contracts solve it */}
        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-3">
            How Trust Continuity Solves It: The 3 Core Innovations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                Innovation 1: On-Chain Identity Registry
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                Personnel status is maintained directly in <code className="font-mono text-blue-900 font-semibold">IdentityRegistry.sol</code>. An administrator can revoke an identity in one transaction, acting as an instantaneous, irreversible kill-switch.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                Innovation 2: Dual-Condition Authorization
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                The smart contract enforces <code className="font-mono text-blue-900 font-semibold">onlyActiveManager</code>: an action requires BOTH the Manager role AND an active identity. If identity is revoked, all actions revert immediately even if the role still exists.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                Innovation 3: Governed Hardware NFTs
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                Standard ERC-721 direct transfers (<code className="font-mono text-blue-900 font-semibold">transferFrom</code>) are disabled. Custody handoffs can only occur via <code className="font-mono text-blue-900 font-semibold">custodyTransfer()</code>, emitting cryptographic event evidence forever.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. 2-MINUTE JUDGE DEMONSTRATION WORKFLOW                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-blue-800" />
              2-Minute Demonstration Flow for Judges & Evaluators
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Execute this exact 5-step sequence during your presentation to prove complete end-to-end governance.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-bold text-blue-800 hover:text-blue-950 flex items-center gap-1"
          >
            <span>Open Operational Console</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Step 1 */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">
                STEP 1: ENROLLMENT
              </span>
              <h4 className="text-xs font-bold text-slate-900 mb-1">Verify Identity</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Show Administrator registering Engineer A in the on-chain registry.
              </p>
            </div>
            <Link
              href="/identities"
              className="text-[11px] font-bold text-blue-800 hover:text-blue-950 mt-3 inline-flex items-center gap-1"
            >
              Go to Identities <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">
                STEP 2: MINTING
              </span>
              <h4 className="text-xs font-bold text-slate-900 mb-1">Mint Defense Asset</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Engineer A mints radar module with SHA-256 document hashing.
              </p>
            </div>
            <Link
              href="/assets"
              className="text-[11px] font-bold text-blue-800 hover:text-blue-950 mt-3 inline-flex items-center gap-1"
            >
              Go to Assets <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">
                STEP 3: CUSTODY
              </span>
              <h4 className="text-xs font-bold text-slate-900 mb-1">Transfer Custody</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Manager assigns physical custody of hardware to Engineer B.
              </p>
            </div>
            <Link
              href="/assets"
              className="text-[11px] font-bold text-blue-800 hover:text-blue-950 mt-3 inline-flex items-center gap-1"
            >
              Custody Transfer <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Step 4 */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block mb-1">
                STEP 4: REVOCATION
              </span>
              <h4 className="text-xs font-bold text-slate-900 mb-1">Revoke Identity</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Admin revokes Engineer A. Status switches to REVOKED instantly.
              </p>
            </div>
            <Link
              href="/identities"
              className="text-[11px] font-bold text-red-700 hover:text-red-900 mt-3 inline-flex items-center gap-1"
            >
              Revoke Engineer A <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Step 5 */}
          <div className="p-3.5 bg-red-50/70 rounded-xl border border-red-200 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block mb-1">
                STEP 5: ATTACK BLOCKED
              </span>
              <h4 className="text-xs font-bold text-slate-900 mb-1">Contract Reverts</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Revoked Engineer attempts action. Smart contract halts and reverts!
              </p>
            </div>
            <Link
              href="/security"
              className="text-[11px] font-bold text-red-700 hover:text-red-900 mt-3 inline-flex items-center gap-1"
            >
              Execute Attack Test <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. COMPARISON: SQL DATABASE VS BLOCKCHAIN PROTOCOL            */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Architecture Comparison: Traditional Database vs. Trust Continuity
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Key points explaining to judges why a conventional PostgreSQL or MongoDB database cannot solve this problem.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold">
              <tr>
                <th className="px-4 py-3">Security Dimension</th>
                <th className="px-4 py-3 text-red-700">Traditional Web Application (SQL / LDAP)</th>
                <th className="px-4 py-3 text-emerald-800">Trust Continuity Protocol (Solidity Smart Contracts)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              <tr className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-semibold text-slate-900">Enforcement Authority</td>
                <td className="px-4 py-3 text-slate-600">Backend Node/Python server; vulnerable if server is penetrated</td>
                <td className="px-4 py-3 text-emerald-900 font-semibold bg-emerald-50/30">
                  Solidity EVM bytecode running on consensus; mathematically impossible to bypass
                </td>
              </tr>
              <tr className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-semibold text-slate-900">Audit Log Integrity</td>
                <td className="px-4 py-3 text-slate-600">Mutable; anyone with root DB credentials can alter or purge logs</td>
                <td className="px-4 py-3 text-emerald-900 font-semibold bg-emerald-50/30">
                  Immutable; blockchain event logs cannot be edited, overwritten, or erased
                </td>
              </tr>
              <tr className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-semibold text-slate-900">Stale Role Revocation</td>
                <td className="px-4 py-3 text-slate-600">Requires syncing multiple databases; revoked tokens often linger</td>
                <td className="px-4 py-3 text-emerald-900 font-semibold bg-emerald-50/30">
                  Single O(1) on-chain kill-switch instantly invalidates actions across the entire network
                </td>
              </tr>
              <tr className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-semibold text-slate-900">Non-Repudiation</td>
                <td className="px-4 py-3 text-slate-600">Session cookies or API bearer tokens (can be forged or stolen)</td>
                <td className="px-4 py-3 text-emerald-900 font-semibold bg-emerald-50/30">
                  Cryptographic ECDSA digital signatures on every individual transaction
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
