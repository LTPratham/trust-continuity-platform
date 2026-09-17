"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useWallet } from "../../lib/WalletContext";
import {
  Compass,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  UserCheck,
  UserX,
  Key,
  FileBox,
  History,
  Terminal,
  HelpCircle,
  Copy,
  Check,
  ChevronRight,
  PlayCircle
} from "lucide-react";

export default function WalkthroughPage() {
  const { currentAccount, selectDemoAccount } = useWallet();
  const [activeTab, setActiveTab] = useState<"tour" | "script" | "faq">("tour");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyScript = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const walkthroughSteps = [
    {
      step: 1,
      page: "Identities Page",
      href: "/identities",
      title: "Step 1: Check Registered Employees & Roles",
      actor: "Account 0 [ADMIN] or Account 1 [MANAGER]",
      whatToNotice: "Notice the status badge is green (ACTIVE) and roles are explicitly assigned (ADMIN, MANAGER, AUDITOR, USER).",
      behindTheScenes: "IdentityRegistry.sol stores employee state on the blockchain. Notice Engineer A holds MANAGER_ROLE in AssetNFT.sol.",
      actionLabel: "View Identities",
      actionHref: "/identities",
      switchAccountIndex: 0,
    },
    {
      step: 2,
      page: "Assets Page",
      href: "/assets",
      title: "Step 2: Mint a Governed Defense Asset",
      actor: "Account 1 [MANAGER - Engineer A]",
      whatToNotice: "The browser computes a SHA-256 hash of the technical document. Only the 32-byte hash is sent to the blockchain — zero classified blueprints leaked!",
      behindTheScenes: "AssetNFT.mintAsset() checks modifier onlyActiveManager(). Because Engineer A has MANAGER_ROLE and is ACTIVE in IdentityRegistry, the EVM permits the mint.",
      actionLabel: "Go to Assets & Mint",
      actionHref: "/assets",
      switchAccountIndex: 1,
    },
    {
      step: 3,
      page: "Assets Page",
      href: "/assets",
      title: "Step 3: Transfer Controlled Custody",
      actor: "Account 1 [MANAGER - Engineer A]",
      whatToNotice: "Notice that standard NFT transfers (transferFrom) are disabled! The current holder cannot sell or surrender equipment. Custody changes strictly via governance action.",
      behindTheScenes: "AssetNFT.custodyTransfer() updates the custodian on-chain and emits an immutable event AssetCustodyTransferred.",
      actionLabel: "Transfer Custody",
      actionHref: "/assets",
      switchAccountIndex: 1,
    },
    {
      step: 4,
      page: "Identities Page",
      href: "/identities",
      title: "Step 4: Revoke Engineer A (Simulate Employee Departure)",
      actor: "Account 0 [ADMIN]",
      whatToNotice: "Admin revokes Engineer A. Status badge flips to red: REVOKED. Crucial note: Engineer A still retains MANAGER_ROLE in AccessControl!",
      behindTheScenes: "IdentityRegistry.revokeIdentity() sets active = false. Last-admin protection prevents Admin from revoking themselves.",
      actionLabel: "Revoke Engineer A",
      actionHref: "/identities",
      switchAccountIndex: 0,
    },
    {
      step: 5,
      page: "Security Demo",
      href: "/security",
      title: "Step 5: The Flagship Attack Revert Demonstration",
      actor: "Account 1 [Engineer A] or Account 2 [Engineer B]",
      whatToNotice: "Click 'Attempt Mint as Engineer A'. The screen flashes a real red banner: ACCESS DENIED — SMART CONTRACT REVERTED. The EVM blocked the transaction!",
      behindTheScenes: "AssetNFT.sol evaluates onlyActiveManager. Even though Engineer A holds MANAGER_ROLE, identityRegistry.isActive() is false. Reverts with IdentityNotActive().",
      actionLabel: "Run Live Attack Demo",
      actionHref: "/security",
      switchAccountIndex: 1,
    },
    {
      step: 6,
      page: "Audit History",
      href: "/audit",
      title: "Step 6: Immutable Evidence & Forensics",
      actor: "Account 3 [AUDITOR]",
      whatToNotice: "Auditor views every action: Registration, Mint, Custody Transfer, Revocation, and the Blocked Attack attempts, with exact timestamps and transaction hashes.",
      behindTheScenes: "Audit logs are queried directly from EVM event receipts. No database administrator can delete or alter them without invalidating block hashes.",
      actionLabel: "Inspect Audit Trail",
      actionHref: "/audit",
      switchAccountIndex: 3,
    },
  ];

  const speechScript = [
    {
      time: "0:00 - 0:30",
      title: "The Problem & Context (BEL)",
      speech: "Good morning judges. For Bharat Electronics Limited, managing defense equipment like radars, avionics processors, and secure testing benches requires absolute certainty. In traditional software, if an employee leaves or is reassigned, their account credentials linger in siloed databases. Furthermore, a rogue database administrator can quietly change asset ownership without leaving proof. Our solution is the Trust Continuity Platform.",
    },
    {
      time: "0:30 - 1:00",
      title: "Identity & Asset Governance",
      speech: "Here on the dashboard, you see our 5-Node Continuous Trust Chain. In our on-chain Identity Registry, Admin registers our personnel. Engineer A is active and holds MANAGER_ROLE. As a manager, Engineer A mints asset BEL-TEST-1047. Notice our privacy protection: the browser computes a SHA-256 fingerprint; only proof of the spec is stored on-chain, keeping classified documents off the blockchain.",
    },
    {
      time: "1:00 - 1:40",
      title: "Controlled Custody & Revocation",
      speech: "Standard NFTs allow anyone to transfer or trade tokens. In defense manufacturing, that's a security hole. Our contract disables direct transfers. Only an active manager can execute custody transfers. Now observe our core innovation: Admin revokes Engineer A. Notice Engineer A's identity is now REVOKED, but they still hold MANAGER_ROLE in AccessControl.",
    },
    {
      time: "1:40 - 2:20",
      title: "Live Attack Demonstration (The Proof)",
      speech: "Now Engineer A attempts to mint another asset. The frontend does not fake this check. The transaction is signed and sent directly to the Solidity smart contract. The EVM checks both role and active identity, halts execution, and REVERTS with IdentityNotActive(). Similarly, when Engineer B tries an unauthorized action, the contract REVERTS with NotManager(). The contract is the true mathematical security boundary.",
    },
    {
      time: "2:20 - 3:00",
      title: "The Immutable Evidence Ledger",
      speech: "Finally, on the Audit History screen, an auditor can reconstruct the entire lifecycle: Identity Registered, Asset Minted, Custody Transferred, Identity Revoked, and the blocked attack attempts with exact block hashes. No administrator can delete this evidence. This is Continuous Trust for defense assets.",
    },
  ];

  const faqs = [
    {
      q: "Why use blockchain instead of a normal database like PostgreSQL?",
      a: "In PostgreSQL, any database administrator or root attacker can execute 'UPDATE assets SET custodian = attacker' or truncate audit logs without leaving cryptographic proof. In our smart contracts, transactions require digital signatures, and rules are enforced at the consensus bytecode layer. History cannot be silently erased.",
    },
    {
      q: "Is this cryptocurrency or digital art?",
      a: "No. There are zero cryptocurrencies, no tokens to trade, and no financial speculation. We use the blockchain purely as an immutable distributed state machine to enforce identity, permissions, and physical defense equipment custody.",
    },
    {
      q: "What prevents someone from hacking the website to allow unauthorized access?",
      a: "The website has zero authorization authority. If an attacker modifies the frontend code or intercepts the API to say 'ALLOWED', the actual transaction still goes to the Solidity smart contract on the blockchain. The contract verifies the caller's digital signature and reverts unauthorized calls.",
    },
    {
      q: "What is your novel innovation?",
      a: "Connecting identity active status and role permissions into a single smart-contract condition: Action Allowed = Valid Role AND Identity Active in Registry. Revoking an identity acts as an instant on-chain kill-switch that neutralizes all privileges, solving the orphaned/stale role problem.",
    },
    {
      q: "How are confidential defense documents kept private?",
      a: "Classified blueprints or technical specifications are never stored on-chain. The client browser computes a SHA-256 digital fingerprint. Only this 32-byte cryptographic digest is stored in the contract. Anyone with the document can verify its integrity without leaking secrets.",
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
              <Compass className="w-3.5 h-3.5 text-blue-700" />
              Judge & Evaluator Guidebook
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Presentation Guide & Walkthrough
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Use this guided walkthrough to understand the architecture, test the 6 live demonstration steps,
              or practice your 3-minute pitch with the exact judge script.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 transition-all flex items-center gap-1.5"
            >
              Dashboard
            </Link>
            <Link
              href="/security"
              className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
            >
              <ShieldAlert className="w-4 h-4" />
              Run Attack Demo
            </Link>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 mt-6 -mb-2 space-x-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab("tour")}
            className={`pb-3 px-1 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "tour"
                ? "border-blue-800 text-blue-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            Step-by-Step Live Demo Tour
          </button>
          <button
            onClick={() => setActiveTab("script")}
            className={`pb-3 px-1 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "script"
                ? "border-blue-800 text-blue-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Terminal className="w-4 h-4" />
            3-Minute Judge Presentation Script
          </button>
          <button
            onClick={() => setActiveTab("faq")}
            className={`pb-3 px-1 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "faq"
                ? "border-blue-800 text-blue-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Judge FAQ & Defense Factory Analogy
          </button>
        </div>
      </div>

      {/* Tab 1: Interactive Step-by-Step Tour */}
      {activeTab === "tour" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-700 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-slate-500">Current Actor: </span>
              <span className="font-bold text-slate-900">{currentAccount.label}</span>{" "}
              <span className="font-mono text-slate-500">({currentAccount.address.slice(0, 6)}...{currentAccount.address.slice(-4)})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Status: </span>
              {currentAccount.isActive ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> ACTIVE
                </span>
              ) : currentAccount.isRegistered ? (
                <span className="text-red-700 font-bold flex items-center gap-1">
                  <UserX className="w-3.5 h-3.5" /> REVOKED
                </span>
              ) : (
                <span className="text-amber-700 font-bold">UNREGISTERED</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {walkthroughSteps.map((s) => (
              <div
                key={s.step}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="h-6 w-6 rounded-full bg-blue-100 border border-blue-200 text-blue-800 font-bold text-xs flex items-center justify-center">
                      {s.step}
                    </span>
                    <h2 className="text-sm font-bold text-slate-900">{s.title}</h2>
                    <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-slate-100 text-slate-600 border border-slate-200">
                      {s.page}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="font-bold text-blue-900 block mb-0.5">What to Notice in UI:</span>
                      <p className="text-slate-600">{s.whatToNotice}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="font-bold text-emerald-900 block mb-0.5">What Happens in Smart Contract:</span>
                      <p className="text-slate-600 font-mono text-[11px]">{s.behindTheScenes}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 justify-center">
                  <button
                    onClick={() => selectDemoAccount(s.switchAccountIndex)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 text-center transition-all"
                    title={`Switch actor to ${s.actor}`}
                  >
                    Switch to {s.actor.split(" ")[0]} {s.actor.split(" ")[1]}
                  </button>
                  <Link
                    href={s.actionHref}
                    className="px-3 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                  >
                    {s.actionLabel}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: 3-Minute Presentation Script */}
      {activeTab === "script" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
            <span className="font-bold">Presentation Strategy for Evaluators: </span>
            Keep slides minimal. Point directly to the live screen. Let the smart contract revert speak for itself!
          </div>

          <div className="space-y-3">
            {speechScript.map((item, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-2 relative"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      {item.time}
                    </span>
                    <h2 className="text-sm font-bold text-slate-900">{item.title}</h2>
                  </div>
                  <button
                    onClick={() => copyScript(item.speech, idx)}
                    className="text-slate-500 hover:text-slate-800 text-xs flex items-center gap-1 p-1 rounded hover:bg-slate-100 transition-all"
                    title="Copy paragraph"
                  >
                    {copiedIndex === idx ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedIndex === idx ? "Copied" : "Copy"}</span>
                  </button>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed font-sans pt-1">
                  &ldquo;{item.speech}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Judge FAQ & Defense Analogy */}
      {activeTab === "faq" && (
        <div className="space-y-4">
          {/* Defense Factory Analogy Card */}
          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-blue-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              The Defense Factory Analogy (How to Explain in 20 Seconds)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
              <div className="bg-white p-3.5 rounded-lg border border-blue-200 space-y-1">
                <span className="font-bold text-slate-900">1. Security Badge (Identity Registry)</span>
                <p>An electronic badge. If security revokes it, the door readers turn off immediately.</p>
              </div>
              <div className="bg-white p-3.5 rounded-lg border border-blue-200 space-y-1">
                <span className="font-bold text-slate-900">2. Clearance Level (Role)</span>
                <p>Manager clearance required to sign off movement of classified hardware.</p>
              </div>
              <div className="bg-white p-3.5 rounded-lg border border-blue-200 space-y-1">
                <span className="font-bold text-slate-900">3. Serialized Crate (Asset NFT)</span>
                <p>Radar module in a locked crate with a permanent serial number (BEL-TEST-1047).</p>
              </div>
              <div className="bg-white p-3.5 rounded-lg border border-blue-200 space-y-1">
                <span className="font-bold text-slate-900">4. Interlock Gate (Smart Contract)</span>
                <p>Gate checks both badge status AND clearance. If badge is revoked, gate refuses to open!</p>
              </div>
            </div>
          </div>

          {/* FAQs */}
          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-2"
              >
                <h2 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-blue-50 text-blue-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                    Q
                  </span>
                  {faq.q}
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed pl-7 border-l-2 border-slate-200 ml-2.5">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
