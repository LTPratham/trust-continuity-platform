"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "../lib/WalletContext";
import { DEMO_ACCOUNTS } from "../lib/contracts";
import { 
  ShieldCheck, 
  ShieldAlert, 
  UserCheck, 
  UserX, 
  AlertTriangle, 
  Wallet, 
  Compass, 
  Layers 
} from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const {
    currentAccount,
    selectedDemoIndex,
    selectDemoAccount,
    connectMetaMask,
  } = useWallet();

  const navLinks = [
    { name: "Overview", href: "/" },
    { name: "Dashboard", href: "/dashboard" },
    { name: "Identities", href: "/identities" },
    { name: "Assets", href: "/assets" },
    { name: "Trust Engine", href: "/trust-engine", highlight: true },
    { name: "Attestation", href: "/attestation" },
    { name: "Transfer", href: "/transfer" },
    { name: "RBAC Matrix", href: "/rbac" },
    { name: "Audit Log", href: "/audit" },
    { name: "Security Demo", href: "/security" },
  ];

  const triggerTour = () => {
    window.dispatchEvent(new Event("open-app-tour"));
  };

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-xs">
      {/* Top Defense Agency Bar */}
      <div className="bg-slate-900 px-4 py-1.5 text-xs text-slate-200 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-blue-300 tracking-wider">SIH26125</span>
          <span className="text-slate-500">|</span>
          <span className="font-semibold text-white">Bharat Electronics Limited (BEL)</span>
          <span className="text-slate-500 hidden sm:inline">|</span>
          <span className="text-slate-300 hidden sm:inline">Continuous Trust & Access Control Protocol</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-900/80 text-emerald-300 border border-emerald-700">
            Local EVM (Cancun) Active
          </span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Title */}
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-blue-800 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              TC
            </div>
            <div>
              <Link href="/" className="font-bold text-base text-slate-900 hover:text-blue-800 transition-colors">
                Trust Continuity Platform
              </Link>
              <div className="text-xs text-slate-500">
                Defense Identity & Hardware Custody Protocol
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex space-x-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? link.highlight
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-blue-50 text-blue-800 border border-blue-200"
                      : link.highlight
                      ? "text-red-700 hover:bg-red-50"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {link.highlight ? (
                    <span className="flex items-center space-x-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                      <span>{link.name}</span>
                    </span>
                  ) : (
                    link.name
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Controls: Tour + Wallet + Dev Accounts */}
          <div className="flex items-center space-x-2">
            {/* Take App Tour Button */}
            <button
              onClick={triggerTour}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors"
              title="Open First-Time Guided Walkthrough"
            >
              <Compass className="w-3.5 h-3.5 text-blue-700" />
              <span>App Tour</span>
            </button>

            {/* MetaMask Button */}
            <button
              onClick={connectMetaMask}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border transition-all ${
                currentAccount.mode === "metamask"
                  ? "bg-amber-50 border-amber-300 text-amber-900"
                  : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
              title="Connect browser wallet (MetaMask)"
            >
              <Wallet className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">
                {currentAccount.mode === "metamask" ? "MetaMask Active" : "MetaMask"}
              </span>
            </button>

            {/* Dev Account Switcher */}
            <div className="relative">
              <select
                aria-label="Demo Account Switcher"
                value={currentAccount.mode === "dev_wallet" ? selectedDemoIndex : -1}
                onChange={(e) => {
                  const idx = parseInt(e.target.value);
                  if (idx >= 0) selectDemoAccount(idx);
                }}
                className="bg-white border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
              >
                {currentAccount.mode === "metamask" && (
                  <option value={-1} disabled>
                    [MetaMask Active]
                  </option>
                )}
                <option value="" disabled>
                  Switch Demo Account
                </option>
                {DEMO_ACCOUNTS.map((acc, i) => (
                  <option key={acc.address} value={i}>
                    Account {acc.index}: {acc.label} [{acc.role}]
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Connected Account Context Strip */}
      <div className="bg-slate-100/90 border-t border-slate-200 px-4 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Identity & Status */}
          <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
            <span className="text-slate-500 font-medium">Current Actor:</span>
            <span className="font-bold text-slate-900">{currentAccount.label}</span>
            <span className="font-mono text-slate-500 text-[11px]">
              ({currentAccount.address.slice(0, 6)}...{currentAccount.address.slice(-4)})
            </span>

            {/* Status Badge */}
            {currentAccount.isActive ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <UserCheck className="w-3 h-3 mr-1 text-emerald-700" />
                ACTIVE IDENTITY
              </span>
            ) : currentAccount.isRegistered ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                <UserX className="w-3 h-3 mr-1 text-red-700" />
                IDENTITY REVOKED
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                <AlertTriangle className="w-3 h-3 mr-1 text-amber-700" />
                UNREGISTERED
              </span>
            )}

            {/* Role Badges */}
            <div className="flex space-x-1">
              {currentAccount.roles.length > 0 ? (
                currentAccount.roles.map((r) => (
                  <span
                    key={r}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      r === "ADMIN"
                        ? "bg-purple-100 text-purple-800 border-purple-300"
                        : r === "MANAGER"
                        ? "bg-blue-100 text-blue-800 border-blue-300"
                        : r === "AUDITOR"
                        ? "bg-teal-100 text-teal-800 border-teal-300"
                        : "bg-slate-200 text-slate-800 border-slate-300"
                    }`}
                  >
                    Role: {r}
                  </span>
                ))
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] bg-slate-200 text-slate-600 border border-slate-300">
                  Role: NONE
                </span>
              )}
            </div>
          </div>

          {/* Quick Notice */}
          <div className="text-[11px]">
            {currentAccount.isActive && currentAccount.roles.includes("MANAGER") ? (
              <span className="text-emerald-700 font-medium">✓ Authorized for asset minting and custody transfers</span>
            ) : currentAccount.isRegistered && !currentAccount.isActive ? (
              <span className="text-red-700 font-bold">
                ⚠️ Revoked: Smart contracts will immediately REVERT all privileged actions
              </span>
            ) : currentAccount.roles.includes("ADMIN") ? (
              <span className="text-purple-800 font-medium">✓ Authorized for identity registration and on-chain revocation</span>
            ) : currentAccount.roles.includes("AUDITOR") ? (
              <span className="text-teal-800 font-medium">✓ Independent Auditor: Read-only access to on-chain ledger</span>
            ) : (
              <span className="text-slate-600">Standard user: No privileged permissions</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
