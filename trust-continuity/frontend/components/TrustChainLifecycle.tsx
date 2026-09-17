"use client";

import React from "react";
import { useWallet } from "../lib/WalletContext";
import { CheckCircle2, XCircle, AlertCircle, ShieldCheck, FileCheck, Key, User } from "lucide-react";

export function TrustChainLifecycle() {
  const { currentAccount } = useWallet();

  const isManager = currentAccount.roles.includes("MANAGER");
  const isActive = currentAccount.isActive;
  const isRegistered = currentAccount.isRegistered;

  // Compute status for each link in the continuous trust chain
  const whoState = isActive
    ? { status: "ACTIVE", ok: true, note: `${currentAccount.label} is verified active` }
    : isRegistered
    ? { status: "REVOKED", ok: false, note: `${currentAccount.label} identity is REVOKED` }
    : { status: "UNREGISTERED", ok: false, note: "Identity not recognized on-chain" };

  const whatState = isManager
    ? { status: "MANAGER_ROLE", ok: true, note: "Granted asset governance role" }
    : currentAccount.roles.includes("ADMIN")
    ? { status: "ADMIN_ROLE", ok: true, note: "Granted platform admin role" }
    : currentAccount.roles.includes("AUDITOR")
    ? { status: "AUDITOR_ROLE", ok: true, note: "Read-only audit privileges" }
    : { status: "NO ROLE", ok: false, note: "Lacks Manager permissions" };

  const contractCheck = (isManager && isActive)
    ? { status: "ACTION ALLOWED", ok: true, note: "Both Role & Active Identity verified" }
    : isManager && !isActive
    ? { status: "ACTION BLOCKED", ok: false, note: "REVERT: Identity is revoked in IdentityRegistry" }
    : { status: "ACTION BLOCKED", ok: false, note: "REVERT: Required MANAGER_ROLE missing" };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-200 gap-2">
        <div>
          <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            Continuous Trust Chain (SIH Innovation)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Every privileged action must satisfy identity, permission, and on-chain contract enforcement.
          </p>
        </div>
        <div className="text-left sm:text-right">
          <span className="text-[11px] text-slate-500">Enforcement Authority:</span>
          <div className="text-xs font-bold text-emerald-700">Solidity Smart Contracts (EVM Bytecode)</div>
        </div>
      </div>

      {/* 5-Node Chain */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {/* Node 1: WHO */}
        <div className={`p-3 rounded-lg border flex flex-col justify-between ${
          whoState.ok ? "bg-emerald-50/70 border-emerald-200 text-emerald-950" : "bg-red-50 border-red-200 text-red-950"
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">1. WHO</span>
              <User className={`w-3.5 h-3.5 ${whoState.ok ? "text-emerald-700" : "text-red-700"}`} />
            </div>
            <div className="text-xs font-bold text-slate-900 mb-0.5">Identity Registry</div>
            <div className={`text-xs font-bold flex items-center gap-1 ${whoState.ok ? "text-emerald-700" : "text-red-700"}`}>
              {whoState.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {whoState.status}
            </div>
          </div>
          <div className="text-[11px] text-slate-600 mt-2 border-t border-slate-200/80 pt-1.5">
            {whoState.note}
          </div>
        </div>

        {/* Node 2: WHAT */}
        <div className={`p-3 rounded-lg border flex flex-col justify-between ${
          whatState.ok ? "bg-blue-50/70 border-blue-200 text-blue-950" : "bg-slate-50 border-slate-200 text-slate-800"
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">2. WHAT</span>
              <Key className={`w-3.5 h-3.5 ${whatState.ok ? "text-blue-700" : "text-slate-400"}`} />
            </div>
            <div className="text-xs font-bold text-slate-900 mb-0.5">Role Permission</div>
            <div className={`text-xs font-bold flex items-center gap-1 ${whatState.ok ? "text-blue-700" : "text-amber-700"}`}>
              {whatState.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {whatState.status}
            </div>
          </div>
          <div className="text-[11px] text-slate-600 mt-2 border-t border-slate-200/80 pt-1.5">
            {whatState.note}
          </div>
        </div>

        {/* Node 3: WHICH ASSET */}
        <div className="p-3 rounded-lg border bg-slate-50 border-slate-200 text-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">3. WHICH ASSET</span>
              <FileCheck className="w-3.5 h-3.5 text-blue-700" />
            </div>
            <div className="text-xs font-bold text-slate-900 mb-0.5">Governed Asset</div>
            <div className="text-xs font-bold text-blue-800">
              BEL-TEST-1047
            </div>
          </div>
          <div className="text-[11px] text-slate-600 mt-2 border-t border-slate-200/80 pt-1.5">
            Unique Token #1047 control handle
          </div>
        </div>

        {/* Node 4: IS ACTION ALLOWED? */}
        <div className={`p-3 rounded-lg border flex flex-col justify-between ${
          contractCheck.ok ? "bg-emerald-50/70 border-emerald-200" : "bg-red-50 border-red-200"
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">4. ENFORCEMENT</span>
              <ShieldCheck className={`w-3.5 h-3.5 ${contractCheck.ok ? "text-emerald-700" : "text-red-700"}`} />
            </div>
            <div className="text-xs font-bold text-slate-900 mb-0.5">Smart Contract</div>
            <div className={`text-xs font-bold flex items-center gap-1 ${contractCheck.ok ? "text-emerald-700" : "text-red-700"}`}>
              {contractCheck.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {contractCheck.status}
            </div>
          </div>
          <div className="text-[11px] text-slate-600 mt-2 border-t border-slate-200/80 pt-1.5 font-mono">
            {contractCheck.note}
          </div>
        </div>

        {/* Node 5: PROOF */}
        <div className="p-3 rounded-lg border bg-slate-50 border-slate-200 text-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">5. EVIDENCE</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
            </div>
            <div className="text-xs font-bold text-slate-900 mb-0.5">Audit Ledger</div>
            <div className="text-xs font-bold text-teal-700">
              Tamper-Evident
            </div>
          </div>
          <div className="text-[11px] text-slate-600 mt-2 border-t border-slate-200/80 pt-1.5">
            Immutable events with tx hashes
          </div>
        </div>
      </div>
    </div>
  );
}
